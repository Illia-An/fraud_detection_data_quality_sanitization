"""Wave 4 — GET /ready (D-06, OB-03)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.main import create_app
from backend.readiness import (
    DEFAULT_SNAPSHOT_MAX_AGE_DAYS,
    is_snapshot_stale,
    snapshot_age_seconds,
)
from backend.snapshot import (
    ANSWERS_TABLE,
    SCHEMA_VERSION,
    STORE_MONTH_TABLE,
    init_snapshot_schema,
    set_meta,
    utc_now_iso,
)


def _seed(path: Path, *, loaded_at: str, schema_version: str = SCHEMA_VERSION, rows: int = 1) -> None:
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_snapshot_schema(engine)
    with engine.begin() as conn:
        if rows > 0:
            conn.execute(
                text(
                    f"""
INSERT INTO {ANSWERS_TABLE} (
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month, LoadedAt
) VALUES
    ('1', 10012, 5, NULL, 'a@x', NULL, NULL, 10,
     '2026-01-05 10:00:00', 2026, 1, :loaded)
"""
                ),
                {"loaded": loaded_at},
            )
            conn.execute(
                text(
                    f"""
INSERT INTO {STORE_MONTH_TABLE}
    (PrintStore, Year, Month, total_count, top_box_count)
VALUES (10, 2026, 1, 1, 1)
"""
                )
            )
    set_meta(
        engine,
        {
            "loaded_at": loaded_at,
            "row_count": str(rows),
            "store_month_count": "1" if rows > 0 else "0",
            "source_view": "test",
            "from_date": "2026-01-01",
            "schema_version": schema_version,
        },
    )


def test_snapshot_age_and_stale_helpers() -> None:
    now = datetime(2026, 11, 16, tzinfo=timezone.utc)
    fresh = (now - timedelta(days=1)).isoformat()
    old = (now - timedelta(days=30)).isoformat()
    assert snapshot_age_seconds(fresh, now=now) == pytest.approx(86400.0)
    assert is_snapshot_stale(fresh, now=now, max_age_days=14) is False
    assert is_snapshot_stale(old, now=now, max_age_days=14) is True
    assert DEFAULT_SNAPSHOT_MAX_AGE_DAYS == 14.0


def test_ready_ok(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "ok.sqlite"
    _seed(db, loaded_at=utc_now_iso())
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "14")

    client = TestClient(create_app())
    res = client.get("/ready")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ready"
    assert body["schema_ok"] is True
    assert body["snapshot_present"] is True
    assert body["snapshot_row_count"] == 1
    assert body["reasons"] == []
    assert body["snapshot_max_age_days"] == 14.0


def test_ready_missing_snapshot(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    missing = tmp_path / "missing.sqlite"
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{missing.as_posix()}")

    client = TestClient(create_app())
    res = client.get("/ready")
    assert res.status_code == 503
    body = res.json()
    assert body["status"] == "not_ready"
    assert "snapshot_missing" in body["reasons"]


def test_ready_stale(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "stale.sqlite"
    old = (datetime.now(timezone.utc) - timedelta(days=40)).replace(microsecond=0).isoformat()
    _seed(db, loaded_at=old)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")
    monkeypatch.setenv("SNAPSHOT_MAX_AGE_DAYS", "14")

    client = TestClient(create_app())
    res = client.get("/ready")
    assert res.status_code == 503
    assert "stale" in res.json()["reasons"]


def test_ready_schema_mismatch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "schema.sqlite"
    _seed(db, loaded_at=utc_now_iso(), schema_version="0")
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")

    client = TestClient(create_app())
    res = client.get("/ready")
    assert res.status_code == 503
    assert "schema_mismatch" in res.json()["reasons"]
    assert res.json()["schema_ok"] is False


def test_ready_empty_rows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "empty.sqlite"
    _seed(db, loaded_at=utc_now_iso(), rows=0)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db.as_posix()}")

    client = TestClient(create_app())
    res = client.get("/ready")
    assert res.status_code == 503
    assert "empty_rows" in res.json()["reasons"]


def test_health_stays_ok_when_not_ready(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    missing = tmp_path / "gone.sqlite"
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{missing.as_posix()}")
    client = TestClient(create_app())
    assert client.get("/ready").status_code == 503
    assert client.get("/health").status_code == 200
