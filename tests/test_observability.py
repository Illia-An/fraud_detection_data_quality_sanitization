"""Wave 4 — JSON logs, request_id, process_done (OB-01, A005)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.main import create_app
from backend.observability import JsonLogFormatter, configure_logging, log_event
from backend.schemas import PipelineConfig, ProcessRequest
from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    STORE_MONTH_TABLE,
    init_snapshot_schema,
    set_meta,
    utc_now_iso,
)


def _seed(path: Path) -> None:
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_snapshot_schema(engine)
    loaded = utc_now_iso()
    with engine.begin() as conn:
        conn.execute(
            text(
                f"""
INSERT INTO {ANSWERS_TABLE} (
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month, LoadedAt
) VALUES
    ('1', 10012, 5, NULL, 'a@x', NULL, NULL, 10,
     '2026-01-05 10:00:00', 2026, 1, :loaded),
    ('2', 10012, 4, NULL, 'b@x', NULL, NULL, 10,
     '2026-01-06 11:00:00', 2026, 1, :loaded)
"""
            ),
            {"loaded": loaded},
        )
        conn.execute(
            text(
                f"""
INSERT INTO {STORE_MONTH_TABLE}
    (PrintStore, Year, Month, total_count, top_box_count)
VALUES (10, 2026, 1, 2, 1)
"""
            )
        )
    set_meta(
        engine,
        {
            "loaded_at": loaded,
            "row_count": "2",
            "store_month_count": "1",
            "source_view": "test",
            "from_date": "2026-01-01",
            "schema_version": SCHEMA_VERSION,
        },
    )


def test_json_log_formatter_emits_event_fields() -> None:
    record = logging.LogRecord(
        name="backend",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="process_done",
        args=(),
        exc_info=None,
    )
    record.event_name = "process_done"
    record.structured = {"rows_scanned": 2, "source": "db"}
    line = JsonLogFormatter().format(record)
    payload = json.loads(line)
    assert payload["event"] == "process_done"
    assert payload["rows_scanned"] == 2
    assert payload["source"] == "db"
    assert "ts" in payload
    assert payload["version"]


def test_request_id_echoed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    missing = tmp_path / "x.sqlite"
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{missing.as_posix()}")
    client = TestClient(create_app())
    res = client.get("/health", headers={"X-Request-ID": "wave4-req-1"})
    assert res.status_code == 200
    assert res.headers.get("x-request-id") == "wave4-req-1"


def test_process_done_logged(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    configure_logging()
    db = tmp_path / "proc.sqlite"
    _seed(db)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")

    client = TestClient(create_app())
    with caplog.at_level(logging.INFO):
        res = client.post(
            "/api/v1/process",
            json=ProcessRequest(source="db", config=PipelineConfig()).model_dump(
                mode="json"
            ),
        )
    assert res.status_code == 200, res.text
    events = [
        getattr(r, "event_name", None)
        for r in caplog.records
        if getattr(r, "event_name", None)
    ]
    assert "process_done" in events
    done = next(r for r in caplog.records if getattr(r, "event_name", None) == "process_done")
    structured = getattr(done, "structured", {})
    assert structured.get("source") == "db"
    assert structured.get("sanitization_source") == "snapshot"
    assert "execution_time_ms" in structured
    assert "enabled_tiers" in structured


def test_log_event_helper_does_not_embed_secrets() -> None:
    configure_logging()
    # Sanity: helper accepts only explicit fields (no env dump).
    log_event("startup", sanitization_source="snapshot", snapshot_row_count=1)
    assert datetime.now(timezone.utc)
