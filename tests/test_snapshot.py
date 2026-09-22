"""TASK-10: Local SQLite daily snapshot (SPEC §5.4)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.db_sample import DbSampleQuery
from backend.main import create_app
from backend.queries import (
    build_actual_baseline_sql,
    build_tier_candidate_sql,
    get_actual_baseline_aggregates,
    get_tier_candidate_rows,
)
from backend.schemas import PipelineConfig, ProcessRequest
from backend.snapshot import (
    ANSWERS_TABLE,
    STORE_MONTH_TABLE,
    get_sanitization_source,
    init_snapshot_schema,
    meta_as_dict,
    read_meta,
    set_meta,
    utc_now_iso,
)
from fraud_guard.tier1 import CUSTOMER_BLACKLIST_VALUE
from fraud_guard.pii import hash_pii_value


def test_get_sanitization_source_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SANITIZATION_SOURCE", raising=False)
    assert get_sanitization_source() == "view"


def test_get_sanitization_source_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    assert get_sanitization_source() == "snapshot"


def test_build_actual_baseline_sql_snapshot_uses_store_month() -> None:
    sql, params = build_actual_baseline_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        store_ids=[82],
        dialect="sqlite",
    )
    assert "SELECT *" not in sql
    assert STORE_MONTH_TABLE in sql
    assert "GROUP BY" not in sql
    assert "total_count" in sql
    assert params["store_id_0"] == 82
    assert params["sm_from_year"] == 2026
    assert params["sm_from_month"] == 1
    assert "sm_to_year" not in params


def test_build_actual_baseline_sql_snapshot_applies_to_date() -> None:
    sql, params = build_actual_baseline_sql(
        DbSampleQuery(from_date=date(2026, 2, 1), to_date=date(2026, 2, 28)),
        dialect="sqlite",
    )
    assert "sm_to_year" in sql or ":sm_to_year" in sql
    assert params["sm_from_year"] == 2026
    assert params["sm_from_month"] == 2
    assert params["sm_to_year"] == 2026
    assert params["sm_to_month"] == 2


def test_build_tier_candidate_sql_snapshot_uses_answers() -> None:
    sql, params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(tier1_blacklist_enabled=True),
        dialect="sqlite",
    )
    assert ANSWERS_TABLE in sql
    assert "dbo.TargetsByMetrics_RateGetAnswers" not in sql
    assert "BlackList IS NULL OR BlackList <> :customer_bl" in sql or (
        "b.BlackList IS NULL OR b.BlackList <> :customer_bl" in sql
    )
    assert "freq_groups" in sql
    assert params["customer_bl"] == CUSTOMER_BLACKLIST_VALUE
    assert params["from_date"] == "2026-01-01"


def _seed_mini_snapshot(path: Path) -> None:
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
    ('1', 10012, 5, 'עובד', 'alice@x', NULL, NULL, 10,
     '2026-01-05 10:00:00', 2026, 1, :loaded),
    ('2', 10012, 4, :customer, 'bob@x', NULL, NULL, 10,
     '2026-01-06 11:00:00', 2026, 1, :loaded),
    ('3', 10012, 5, NULL, 'carol@x', NULL, NULL, 20,
     '2026-02-01 09:00:00', 2026, 2, :loaded)
"""
            ),
            {"loaded": loaded, "customer": CUSTOMER_BLACKLIST_VALUE},
        )
        conn.execute(
            text(
                f"""
INSERT INTO {STORE_MONTH_TABLE}
    (PrintStore, Year, Month, total_count, top_box_count)
VALUES
    (10, 2026, 1, 2, 1),
    (20, 2026, 2, 1, 1)
"""
            )
        )
    set_meta(
        engine,
        {
            "loaded_at": loaded,
            "row_count": "3",
            "store_month_count": "2",
            "source_view": "dbo.TargetsByMetrics_RateGetAnswers",
            "from_date": "2026-01-01",
        },
    )


def test_snapshot_query_a_and_b_roundtrip(tmp_path: Path) -> None:
    db_path = tmp_path / "mini.sqlite"
    _seed_mini_snapshot(db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")

    baseline = get_actual_baseline_aggregates(
        engine, date(2026, 1, 1), dialect="sqlite"
    )
    assert baseline.total_responses == 3
    assert baseline.top_box_count == 2
    assert baseline.top_box_pct == round(100.0 * 2 / 3, 4)
    assert len(baseline.by_store_period) == 2

    sample = get_tier_candidate_rows(
        engine,
        date(2026, 1, 1),
        None,
        PipelineConfig(tier1_blacklist_enabled=True),
        dialect="sqlite",
    )
    # Customer BlackList row excluded; 2 candidates.
    assert sample.meta.row_count == 2
    contacts = {r.UserContact for r in sample.rows}
    assert hash_pii_value("alice@x") in contacts
    assert hash_pii_value("carol@x") in contacts
    assert hash_pii_value("bob@x") not in contacts


def test_read_meta_and_as_dict(tmp_path: Path) -> None:
    db_path = tmp_path / "meta.sqlite"
    _seed_mini_snapshot(db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    meta = read_meta(engine)
    assert meta.row_count == 3
    assert meta.store_month_count == 2
    assert meta.from_date == "2026-01-01"
    d = meta_as_dict(meta)
    assert d["sanitization_source"] == "snapshot"
    assert d["snapshot_row_count"] == 3


def test_process_db_uses_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "proc.sqlite"
    _seed_mini_snapshot(db_path)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db_path.as_posix()}")

    client = TestClient(create_app())
    resp = client.post(
        "/api/v1/process",
        json=ProcessRequest(source="db", config=PipelineConfig()).model_dump(
            mode="json"
        ),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["baseline_top_box_pct"] == round(100.0 * 2 / 3, 4)
    assert body["meta"]["sanitization_source"] == "snapshot"
    assert body["meta"]["query_b_mode"] == "tier1_full"
    assert body["meta"]["snapshot_row_count"] == 3
    assert body["meta"]["query_a_total_responses"] == 3
    assert body["meta"]["execution_time_ms"] > 0
    assert body["meta"]["db_query_a_time_ms"] is not None
    assert body["meta"]["db_query_b_time_ms"] is not None
    assert body["meta"]["period_start"] == "2025-01-01"
    assert body["meta"]["period_end"] is None


def test_process_db_respects_custom_period(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Narrow window to Feb-2026 only — one store-month cell in the mini snapshot."""
    db_path = tmp_path / "proc_period.sqlite"
    _seed_mini_snapshot(db_path)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db_path.as_posix()}")

    client = TestClient(create_app())
    resp = client.post(
        "/api/v1/process",
        json={
            "source": "db",
            "config": {},
            "from_date": "2026-02-01",
            "to_date": "2026-02-28",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["meta"]["period_start"] == "2026-02-01"
    assert body["meta"]["period_end"] == "2026-02-28"
    assert body["meta"]["query_a_total_responses"] == 1
    assert body["baseline_top_box_pct"] == 100.0


def test_process_snapshot_missing_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    missing = tmp_path / "nope.sqlite"
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{missing.as_posix()}")
    client = TestClient(create_app())
    resp = client.post(
        "/api/v1/process",
        json={"source": "db", "config": {}},
    )
    assert resp.status_code == 503
