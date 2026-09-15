"""TASK-07: Query A actual baseline aggregates (SQL pushdown)."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
import pandas as pd

from backend.db_sample import DbSampleQuery
from backend.main import create_app
from backend.queries import (
    ActualBaseline,
    StorePeriodAggregate,
    baseline_from_aggregates,
    build_actual_baseline_sql,
    get_actual_baseline_aggregates,
    network_top_box_pct,
)
from backend.schemas import (
    PipelineConfig,
    ProcessRequest,
    SamplePresetMeta,
    SampleResponse,
    SurveyAnswerRow,
)
from backend.service import run_pipeline
from fraud_guard.tier1 import filter_answered_metric_rows, top_box_rate


def test_build_actual_baseline_sql_no_select_star() -> None:
    sql, params = build_actual_baseline_sql(
        DbSampleQuery(from_date=date(2026, 1, 1), to_date=date(2026, 9, 14)),
        store_ids=[82, 91],
    )
    assert "SELECT *" not in sql
    assert "GROUP BY PrintStore" in sql
    assert "total_count" in sql
    assert "top_box_count" in sql
    assert "Answer_Value IS NOT NULL" in sql
    assert "PrintStore IN" in sql
    assert params["question_id"] == 10012
    assert params["top_box"] == 5
    assert params["store_id_0"] == 82
    assert params["store_id_1"] == 91


def test_network_top_box_pct_four_decimals() -> None:
    assert network_top_box_pct(0, 0) == 0.0
    # 2/3 → 66.6666...%
    assert network_top_box_pct(3, 2) == 66.6667


def test_baseline_from_aggregates_folds_store_periods() -> None:
    rows = [
        StorePeriodAggregate(1.0, 2026, 1, total_count=10, top_box_count=7),
        StorePeriodAggregate(2.0, 2026, 1, total_count=5, top_box_count=5),
    ]
    baseline = baseline_from_aggregates(rows)
    assert baseline.total_responses == 15
    assert baseline.top_box_count == 12
    assert baseline.top_box_pct == network_top_box_pct(15, 12)
    assert len(baseline.by_store_period) == 2


def _pct(rate: float) -> float:
    if rate != rate:
        return 0.0
    return round(rate * 100.0, 4)


def test_actual_baseline_parity_with_inline_pipeline_four_decimals() -> None:
    """Query A fold of answered rows must match run_pipeline actual top_box_pct."""
    rows = [
        SurveyAnswerRow(
            Question_ID=10012,
            Answer_Value=5,
            BlackList="עובד",
            UserContact="a",
            PrintStore=1,
            AnswerTime="2026-01-01T10:00:00",
            Year=2026,
            Month=1,
        ),
        SurveyAnswerRow(
            Question_ID=10012,
            Answer_Value=4,
            BlackList="עובד",
            UserContact="b",
            PrintStore=1,
            AnswerTime="2026-01-01T11:00:00",
            Year=2026,
            Month=1,
        ),
        SurveyAnswerRow(
            Question_ID=10012,
            Answer_Value=5,
            BlackList="עובד",
            UserContact="c",
            PrintStore=2,
            AnswerTime="2026-02-01T10:00:00",
            Year=2026,
            Month=2,
        ),
        SurveyAnswerRow(
            Question_ID=999,
            Answer_Value=5,
            PrintStore=1,
            Year=2026,
            Month=1,
        ),
    ]
    df = pd.DataFrame([r.model_dump(mode="python") for r in rows])
    answered = filter_answered_metric_rows(df)
    # Simulate SQL GROUP BY store × year × month
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
    pushed = baseline_from_aggregates(aggs)
    inline = run_pipeline(ProcessRequest(rows=rows, config=PipelineConfig()))
    assert pushed.total_responses == int(inline.meta["answered_rows"])
    assert pushed.top_box_pct == inline.baseline_top_box_pct
    assert round(pushed.top_box_pct, 4) == round(_pct(top_box_rate(answered)), 4)

    overridden = run_pipeline(
        ProcessRequest(rows=rows, config=PipelineConfig()),
        actual_baseline=pushed,
    )
    assert overridden.steps[0].step_name == "actual"
    assert overridden.steps[0].top_box_pct == pushed.top_box_pct
    assert overridden.steps[0].rows_out == pushed.total_responses
    assert overridden.baseline_top_box_pct == pushed.top_box_pct
    assert overridden.meta["actual_source"] == "query_a"


def test_get_actual_baseline_aggregates_maps_sql_rows() -> None:
    mappings = MagicMock()
    # result.mappings() iterates row mappings
    row_list = [
        {
            "store_id": 82.0,
            "year": 2026,
            "month": 3,
            "total_count": 100,
            "top_box_count": 72,
        }
    ]
    result = MagicMock()
    result.mappings.return_value = row_list
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.connect.return_value = conn

    baseline = get_actual_baseline_aggregates(
        engine, date(2026, 1, 1), date(2026, 9, 14)
    )
    assert baseline.total_responses == 100
    assert baseline.top_box_count == 72
    assert baseline.top_box_pct == 72.0
    assert baseline.by_store_period[0].store_id == 82.0


def test_process_db_uses_query_a_for_actual(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SANITIZATION_SOURCE", "view")
    baseline = ActualBaseline(
        total_responses=3,
        top_box_count=2,
        top_box_pct=66.6667,
        by_store_period=(
            StorePeriodAggregate(1.0, 2026, 2, 3, 2),
        ),
    )
    fake = SampleResponse(
        preset="db_query_b",
        rows=[
            SurveyAnswerRow(
                ParticipateNumber="p1",
                Question_ID=10012,
                Answer_Value=5,
                BlackList="לא",
                UserContact="hashed",
                PrintStore=1,
                AnswerTime="2026-02-01T10:00:00",
                Year=2026,
                Month=2,
            ),
            SurveyAnswerRow(
                ParticipateNumber="p2",
                Question_ID=10012,
                Answer_Value=5,
                BlackList="עובד",
                UserContact="h2",
                PrintStore=1,
                AnswerTime="2026-02-01T11:00:00",
                Year=2026,
                Month=2,
            ),
            SurveyAnswerRow(
                ParticipateNumber="p3",
                Question_ID=10012,
                Answer_Value=4,
                BlackList="עובד",
                UserContact="h3",
                PrintStore=1,
                AnswerTime="2026-02-01T12:00:00",
                Year=2026,
                Month=2,
            ),
        ],
        meta=SamplePresetMeta(
            preset="db_query_b",
            row_count=3,
            store_count=1,
            month_count=1,
            description="from db",
        ),
    )
    monkeypatch.setattr(
        "backend.main.load_actual_baseline_from_settings",
        lambda **_kwargs: baseline,
    )
    monkeypatch.setattr(
        "backend.main.load_tier_candidates_from_settings",
        lambda **_kwargs: fake,
    )
    client = TestClient(create_app())
    res = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["baseline_top_box_pct"] == 66.6667
    assert body["meta"]["actual_source"] == "query_a"
    assert body["meta"]["query_a_total_responses"] == 3
    assert body["meta"]["db_query_a_time_ms"] >= 0
    assert body["meta"]["db_query_b_time_ms"] >= 0
    actual = next(s for s in body["steps"] if s["step_name"] == "actual")
    assert actual["top_box_pct"] == 66.6667
    assert actual["rows_out"] == 3


def test_process_db_empty_query_a(monkeypatch: pytest.MonkeyPatch) -> None:
    empty = ActualBaseline(
        total_responses=0,
        top_box_count=0,
        top_box_pct=0.0,
        by_store_period=(),
    )
    monkeypatch.setattr(
        "backend.main.load_actual_baseline_from_settings",
        lambda **_kwargs: empty,
    )
    client = TestClient(create_app())
    res = client.post("/api/v1/process", json={"source": "db", "config": {}})
    assert res.status_code == 422
