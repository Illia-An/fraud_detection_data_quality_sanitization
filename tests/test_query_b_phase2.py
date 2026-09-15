"""TASK-10 S5: Query B phase 2 (freq + always-5) on SQLite snapshot."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.db_sample import DbSampleQuery
from backend.main import create_app
from backend.queries import (
    build_tier_candidate_sql,
    get_actual_baseline_aggregates,
    get_tier_candidate_rows,
    query_b_mode_for_dialect,
)
from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow
from backend.service import run_pipeline, run_pipeline_pushdown
from backend.snapshot import ANSWERS_TABLE, STORE_MONTH_TABLE, init_snapshot_schema, set_meta, utc_now_iso
from fraud_guard.tier1 import CUSTOMER_BLACKLIST_VALUE
from fraud_guard.pii import hash_pii_value


def test_query_b_mode_for_dialect() -> None:
    assert query_b_mode_for_dialect("sqlite") == "tier1_full"
    assert query_b_mode_for_dialect("mssql") == "blacklist_only"


def test_build_phase2_sql_has_freq_cte() -> None:
    sql, params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(
            tier1_blacklist_enabled=True,
            tier1_freq_threshold=3,
            tier1_always_five_enabled=False,
        ),
        dialect="sqlite",
    )
    assert "SELECT *" not in sql
    assert "freq_groups" in sql
    assert "HAVING COUNT(*) >= :freq_min" in sql
    assert "always5_entities" not in sql
    assert params["freq_min"] == 3
    assert ANSWERS_TABLE in sql


def test_build_phase2_sql_omits_freq_when_disabled() -> None:
    sql, params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(
            tier1_blacklist_enabled=True,
            tier1_freq_enabled=False,
            tier1_always_five_enabled=False,
        ),
        dialect="sqlite",
    )
    assert "freq_groups" not in sql
    assert "freq_min" not in params
    assert "b.BlackList IS NULL OR b.BlackList <> :customer_bl" in sql


def test_build_phase2_sql_includes_always5_when_enabled() -> None:
    sql, params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(
            tier1_always_five_enabled=True,
            tier1_always_five_min_n=10,
        ),
        dialect="sqlite",
    )
    assert "always5_entities" in sql
    assert params["always_min"] == 10


def test_mssql_v1_still_blacklist_only_no_freq() -> None:
    sql, _params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(tier1_always_five_enabled=True),
        dialect="mssql",
    )
    assert "freq_groups" not in sql
    assert "always5_entities" not in sql
    assert "BlackList IS NULL OR BlackList <> :customer_bl" in sql


def _seed_phase2_snapshot(path: Path) -> None:
    """Mix: staff blacklist, freq customer (3× same day), always-5 entity, clean customer."""
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    init_snapshot_schema(engine)
    loaded = utc_now_iso()
    rows = [
        # Staff blacklist (top-box)
        ("s1", 5, "עובד", "staff@x", 10, "2026-01-10 10:00:00", 2026, 1),
        # Freq: same customer × store × day, 3 answers (threshold 3)
        ("f1", 5, CUSTOMER_BLACKLIST_VALUE, "freq@x", 10, "2026-01-10 11:00:00", 2026, 1),
        ("f2", 5, CUSTOMER_BLACKLIST_VALUE, "freq@x", 10, "2026-01-10 12:00:00", 2026, 1),
        ("f3", 4, CUSTOMER_BLACKLIST_VALUE, "freq@x", 10, "2026-01-10 13:00:00", 2026, 1),
        # Always-5 entity (n=10, all fives) — store 20 Jan
        *[
            (
                f"a{i}",
                5,
                CUSTOMER_BLACKLIST_VALUE,
                "always5@x",
                20,
                f"2026-01-{i:02d} 09:00:00",
                2026,
                1,
            )
            for i in range(1, 11)
        ],
        # Clean customer (should NOT be a Query B candidate)
        ("c1", 5, CUSTOMER_BLACKLIST_VALUE, "clean@x", 30, "2026-02-01 10:00:00", 2026, 2),
        ("c2", 4, CUSTOMER_BLACKLIST_VALUE, "clean@x", 30, "2026-02-02 10:00:00", 2026, 2),
    ]
    with engine.begin() as conn:
        for pn, av, bl, contact, store, at, year, month in rows:
            conn.execute(
                text(
                    f"""
INSERT INTO {ANSWERS_TABLE} (
    ParticipateNumber, Question_ID, Answer_Value, BlackList,
    UserContact, PhoneFromLog, ext_user_id, PrintStore,
    AnswerTime, Year, Month, LoadedAt
) VALUES (
    :pn, 10012, :av, :bl, :contact, NULL, NULL, :store,
    :at, :year, :month, :loaded
)
"""
                ),
                {
                    "pn": pn,
                    "av": av,
                    "bl": bl,
                    "contact": contact,
                    "store": store,
                    "at": at,
                    "year": year,
                    "month": month,
                    "loaded": loaded,
                },
            )
        conn.execute(
            text(
                f"""
INSERT INTO {STORE_MONTH_TABLE}
    (PrintStore, Year, Month, total_count, top_box_count)
SELECT
    PrintStore, Year, Month,
    COUNT(*) AS total_count,
    SUM(CASE WHEN Answer_Value = 5 THEN 1 ELSE 0 END) AS top_box_count
FROM {ANSWERS_TABLE}
GROUP BY PrintStore, Year, Month
"""
            )
        )
    set_meta(
        engine,
        {
            "loaded_at": loaded,
            "row_count": str(len(rows)),
            "store_month_count": "3",
            "source_view": "test",
            "from_date": "2026-01-01",
        },
    )


def test_phase2_candidates_include_freq_and_always5(tmp_path: Path) -> None:
    db_path = tmp_path / "p2.sqlite"
    _seed_phase2_snapshot(db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    cfg = PipelineConfig(
        tier1_blacklist_enabled=True,
        tier1_freq_threshold=3,
        tier1_always_five_enabled=True,
        tier1_always_five_min_n=10,
    )
    sample = get_tier_candidate_rows(
        engine, date(2026, 1, 1), None, cfg, dialect="sqlite"
    )
    # staff(1) + freq(3) + always5(10) = 14; clean pair excluded
    assert sample.meta.row_count == 14
    assert "phase 2" in sample.meta.description
    contacts = {r.UserContact for r in sample.rows}
    assert hash_pii_value("staff@x") in contacts
    assert hash_pii_value("freq@x") in contacts
    assert hash_pii_value("always5@x") in contacts
    assert hash_pii_value("clean@x") not in contacts


def test_phase2_pushdown_kpi_parity_with_inline(tmp_path: Path) -> None:
    """Pushdown tier1_full on snapshot candidates ≈ full inline pipeline."""
    db_path = tmp_path / "parity.sqlite"
    _seed_phase2_snapshot(db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    cfg = PipelineConfig(
        tier1_blacklist_enabled=True,
        tier1_freq_threshold=3,
        tier1_always_five_enabled=True,
        tier1_always_five_min_n=10,
        tier2_min_volume=30,  # cells small → no Tier2 wipe in this fixture
        tier2_z_threshold=2.0,
        tier2_pct_threshold=90.0,
    )

    baseline = get_actual_baseline_aggregates(
        engine, date(2026, 1, 1), dialect="sqlite"
    )
    sample = get_tier_candidate_rows(
        engine, date(2026, 1, 1), None, cfg, dialect="sqlite"
    )
    pushed = run_pipeline_pushdown(
        baseline, sample.rows, cfg, query_b_mode="tier1_full"
    )

    # Inline: load all raw rows (unhashed) from sqlite
    with engine.connect() as conn:
        raw = [dict(m) for m in conn.execute(text(f"SELECT * FROM {ANSWERS_TABLE}")).mappings()]
    # Avoid SELECT * in production; OK in test. Map to SurveyAnswerRow.
    all_rows = [
        SurveyAnswerRow.model_validate(
            {
                **r,
                "ParticipateNumber": str(r["ParticipateNumber"]),
                "Answer_Value": int(r["Answer_Value"]),
            }
        )
        for r in raw
    ]
    inline = run_pipeline(ProcessRequest(source="inline", rows=all_rows, config=cfg))

    assert pushed.meta["query_b_mode"] == "tier1_full"
    assert pushed.baseline_top_box_pct == inline.baseline_top_box_pct
    assert pushed.final_top_box_pct == inline.final_top_box_pct
    assert pushed.network_delta_pp == inline.network_delta_pp
    # Tier1 must drop staff + freq(3) + always5(10) = 14
    assert pushed.steps[1].rows_dropped == 14
    reasons = pushed.meta["drop_reasons"]["tier1"]
    assert reasons.get("blacklist_non_customer", 0) >= 1
    assert reasons.get("high_freq_store_day", 0) >= 3
    assert reasons.get("always_topbox", 0) >= 10


def test_process_db_snapshot_phase2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "api.sqlite"
    _seed_phase2_snapshot(db_path)
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("SNAPSHOT_URL", f"sqlite:///{db_path.as_posix()}")

    client = TestClient(create_app())
    resp = client.post(
        "/api/v1/process",
        json={
            "source": "db",
            "config": {
                "tier1_always_five_enabled": True,
                "tier1_always_five_min_n": 10,
                "tier1_freq_threshold": 3,
                "tier2_min_volume": 30,
            },
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["meta"]["sanitization_source"] == "snapshot"
    assert body["meta"]["query_b_mode"] == "tier1_full"
    assert body["meta"]["query_b_candidate_rows"] == 14
    assert body["steps"][1]["rows_dropped"] == 14
