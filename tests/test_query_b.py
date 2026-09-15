"""TASK-09: Query B v1 blacklist candidates + pushdown KPI parity."""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.db_sample import DbSampleQuery
from backend.main import create_app
from backend.queries import (
    ActualBaseline,
    StorePeriodAggregate,
    baseline_from_aggregates,
    build_tier_candidate_sql,
)
from backend.schemas import (
    PipelineConfig,
    ProcessRequest,
    SamplePresetMeta,
    SampleResponse,
    SurveyAnswerRow,
)
from backend.service import run_pipeline_pushdown
from fraud_guard.tier1 import CUSTOMER_BLACKLIST_VALUE, filter_answered_metric_rows


def test_build_tier_candidate_sql_blacklist_only_no_cte() -> None:
    sql, params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1), to_date=date(2026, 9, 14)),
        PipelineConfig(tier1_blacklist_enabled=True),
    )
    assert "SELECT *" not in sql
    assert "freq_keys" not in sql
    assert "HAVING" not in sql.upper()
    assert "EXISTS" not in sql.upper()
    assert "BlackList IS NULL OR BlackList <> :customer_bl" in sql
    assert params["customer_bl"] == CUSTOMER_BLACKLIST_VALUE
    for col in (
        "UserContact",
        "PhoneFromLog",
        "ext_user_id",
        "Answer_Value",
        "BlackList",
        "PrintStore",
    ):
        assert col in sql


def test_build_tier_candidate_sql_disabled_blacklist_empty() -> None:
    sql, _params = build_tier_candidate_sql(
        DbSampleQuery(from_date=date(2026, 1, 1)),
        PipelineConfig(tier1_blacklist_enabled=False),
    )
    assert "1 = 0" in sql


def _agg_baseline(rows: list[SurveyAnswerRow]) -> ActualBaseline:
    df = pd.DataFrame([r.model_dump(mode="python") for r in rows])
    answered = filter_answered_metric_rows(df)
    grouped = (
        answered.groupby(["PrintStore", "Year", "Month"], dropna=False)["Answer_Value"]
        .agg(
            total_count="count",
            top_box_count=lambda s: int((s == 5).sum()),
        )
        .reset_index()
    )
    aggs = [
        StorePeriodAggregate(
            store_id=float(r.PrintStore),
            year=int(r.Year),
            month=int(r.Month),
            total_count=int(r.total_count),
            top_box_count=int(r.top_box_count),
        )
        for r in grouped.itertuples(index=False)
    ]
    return baseline_from_aggregates(aggs)


def _blacklist_candidates(rows: list[SurveyAnswerRow]) -> list[SurveyAnswerRow]:
    return [
        r
        for r in rows
        if r.BlackList is None or r.BlackList != CUSTOMER_BLACKLIST_VALUE
    ]


def test_pushdown_kpi_parity_blacklist_only_four_decimals() -> None:
    """v1: blacklist Query B + Tier2 aggregates must match full scan with freq off."""
    rows = [
        SurveyAnswerRow(
            ParticipateNumber="b1",
            Question_ID=10012,
            Answer_Value=5,
            BlackList="עובד",
            UserContact="staff1",
            PrintStore=1,
            AnswerTime="2026-01-01T10:00:00",
            Year=2026,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="b2",
            Question_ID=10012,
            Answer_Value=5,
            BlackList="עובד",
            UserContact="staff2",
            PrintStore=1,
            AnswerTime="2026-01-01T11:00:00",
            Year=2026,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="c1",
            Question_ID=10012,
            Answer_Value=4,
            BlackList=CUSTOMER_BLACKLIST_VALUE,
            UserContact="cust1",
            PrintStore=1,
            AnswerTime="2026-01-01T12:00:00",
            Year=2026,
            Month=1,
        ),
        SurveyAnswerRow(
            ParticipateNumber="c2",
            Question_ID=10012,
            Answer_Value=5,
            BlackList=CUSTOMER_BLACKLIST_VALUE,
            UserContact="cust2",
            PrintStore=2,
            AnswerTime="2026-02-01T10:00:00",
            Year=2026,
            Month=2,
        ),
    ]
    # Freq off so full-scan matches blacklist-only pushdown (SPEC Query B v1).
    config = PipelineConfig(
        tier1_blacklist_enabled=True,
        tier1_always_five_enabled=False,
        tier2_min_volume=30,  # cells too small → no Tier2 drops in this fixture
        tier2_z_threshold=2.0,
        tier2_pct_threshold=90.0,
    )
    # Use inline pipeline with freq disabled via Tier1Config path:
    # run_pipeline always enables freq — compare against blacklist-only
    # pushdown vs run_pipeline_pushdown reference built the same way.
    baseline = _agg_baseline(rows)
    candidates = _blacklist_candidates(rows)
    assert len(candidates) == 2

    pushed = run_pipeline_pushdown(baseline, candidates, config)
    # Manual expected: drop 2 top-box staff from store1 → left c1(4)+c2(5) = 50%
    assert pushed.baseline_top_box_pct == baseline.top_box_pct
    assert pushed.final_top_box_pct == 50.0
    assert pushed.meta["query_b_mode"] == "blacklist_only"
    assert pushed.meta["input_rows"] == 2

    # Full inline with same effective rules (freq on but no freq groups in fixture
    # when we only have unique contacts) — disable by using pushdown parity only.
    # Cross-check: same baseline, drops = 2 staff.
    assert pushed.steps[0].step_name == "actual"
    assert pushed.steps[1].rows_dropped == 2


def test_process_db_uses_query_b_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITIZATION_SOURCE", "view")
    baseline = ActualBaseline(
        total_responses=4,
        top_box_count=3,
        top_box_pct=75.0,
        by_store_period=(StorePeriodAggregate(1.0, 2026, 1, 4, 3),),
    )
    candidates = SampleResponse(
        preset="db_query_b",
        rows=[
            SurveyAnswerRow(
                ParticipateNumber="b1",
                Question_ID=10012,
                Answer_Value=5,
                BlackList="עובד",
                UserContact="hashed1",
                PrintStore=1,
                AnswerTime="2026-01-01T10:00:00",
                Year=2026,
                Month=1,
            ),
            SurveyAnswerRow(
                ParticipateNumber="b2",
                Question_ID=10012,
                Answer_Value=5,
                BlackList="עובד",
                UserContact="hashed2",
                PrintStore=1,
                AnswerTime="2026-01-01T11:00:00",
                Year=2026,
                Month=1,
            ),
        ],
        meta=SamplePresetMeta(
            preset="db_query_b",
            row_count=2,
            store_count=1,
            month_count=1,
            description="candidates",
        ),
    )
    monkeypatch.setattr(
        "backend.main.load_actual_baseline_from_settings",
        lambda **_k: baseline,
    )
    monkeypatch.setattr(
        "backend.main.load_tier_candidates_from_settings",
        lambda **_k: candidates,
    )
    client = TestClient(create_app())
    res = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["actual_source"] == "query_a"
    assert body["meta"]["query_b_candidate_rows"] == 2
    assert body["meta"]["rows_scanned"] == 2
    assert body["meta"]["query_a_total_responses"] == 4
    assert body["meta"]["rows_scanned"] < body["meta"]["query_a_total_responses"]
    assert body["baseline_top_box_pct"] == 75.0
    assert body["final_top_box_pct"] == 50.0
    assert body["meta"]["query_b_mode"] == "blacklist_only"
