"""Excel report builder writes the given scores and does not recompute them."""

from __future__ import annotations

from io import BytesIO

import pytest
from openpyxl import load_workbook

from excel_report.document import (
    ExcelReportDocument,
    PlanMonthScore,
    PlanVersionContext,
    SanitizationScoreRow,
    StoreMonthMatrix,
    StorePlanMonths,
)
from excel_report.workbook import build_excel_report


def _document(**overrides) -> ExcelReportDocument:
    base = dict(
        method="tier1+tier2",
        period_start="2025-01-01",
        period_end="2025-12-31",
        target=75,
        current_chain=64.3,
        final_chain=75,
        feasible=True,
        sanitization_rows=(
            SanitizationScoreRow(store_id=270, year=2025, month=12, score=64.3),
        ),
        chain_months=(
            PlanMonthScore(year=2026, month=1, score=70),
            PlanMonthScore(year=2026, month=2, score=75),
        ),
        store_plans=(
            StorePlanMonths(
                store_id=270,
                months=(
                    PlanMonthScore(year=2026, month=1, score=68),
                    PlanMonthScore(year=2026, month=2, score=75),
                ),
            ),
        ),
    )
    base.update(overrides)
    return ExcelReportDocument(**base)


def test_workbook_has_three_sheets_and_keeps_target():
    book = load_workbook(BytesIO(build_excel_report(_document())))
    assert book.sheetnames == ["Summary", "Sanitization", "Plan"]

    summary = {row[0].value: row[1].value for row in book["Summary"].iter_rows(min_row=2)}
    assert summary["method"] == "tier1+tier2"
    assert summary["target"] == 75
    assert summary["current_chain"] == 64.3
    assert summary["final_chain"] == 75
    assert summary["feasible"] == "yes"

    cleansed = list(book["Sanitization"].iter_rows(values_only=True))
    assert cleansed[0] == ("store_id", "year", "month", "score")
    assert cleansed[1] == (270, 2025, 12, 64.3)

    plan = list(book["Plan"].iter_rows(values_only=True))
    assert plan[0] == ("store_id", "2026-01", "2026-02")
    assert plan[1] == ("chain", 70, 75)
    assert plan[2] == (270, 68, 75)


def test_store_matrix_and_version_context_sheet():
    targets = tuple(float(i) for i in range(1, 13))
    planned = tuple(float(i) + 0.5 for i in range(1, 13))
    actual = tuple([60.0, 61.0, 62.0] + [None] * 9)
    cum = tuple(float(60 + i) for i in range(12))
    req_m = tuple([None, None, None] + [70.0 + i for i in range(9)])
    req_c = tuple(float(61 + i * 0.5) for i in range(12))
    document = _document(
        store_matrices=(
            StoreMonthMatrix(
                store_id=270,
                monthly_target=targets,
                cumulative_planned=planned,
                actual=actual,
                cumulative_actual_or_simulation=cum,
                required_monthly=req_m,
                required_cumulative=req_c,
            ),
        ),
        plan_version=PlanVersionContext(
            version_id="abc-123",
            created_at="2026-11-09T10:00:00Z",
            label="baseline-v1",
            network_target=75.0,
            as_of_year=2025,
            as_of_month=3,
            planning_year=2025,
            network_mean_at_save=71.2,
        ),
    )
    book = load_workbook(BytesIO(build_excel_report(document)))
    assert book.sheetnames == ["Summary", "Sanitization", "Plan", "StoreMatrix"]

    summary = {row[0].value: row[1].value for row in book["Summary"].iter_rows(min_row=2)}
    assert summary["plan_version_id"] == "abc-123"
    assert summary["plan_version_label"] == "baseline-v1"
    assert summary["plan_version_as_of"] == "2025-03"

    matrix = list(book["StoreMatrix"].iter_rows(values_only=True))
    assert matrix[0] == ("store_id", "metric", *map(str, range(1, 13)))
    assert matrix[1][0] == 270
    assert matrix[1][1] == "monthly_target"
    assert matrix[1][2:] == targets
    assert matrix[3][1] == "actual"
    assert matrix[3][2:5] == (60.0, 61.0, 62.0)
    assert matrix[3][5] is None
    assert matrix[5][1] == "required_monthly"
    assert matrix[5][2:] == req_m
    assert matrix[6][1] == "required_cumulative"
    assert matrix[6][2:] == req_c


def test_empty_sanitization_is_rejected():
    document = _document()
    empty = ExcelReportDocument(
        method=document.method,
        period_start=document.period_start,
        period_end=document.period_end,
        target=document.target,
        current_chain=document.current_chain,
        final_chain=document.final_chain,
        feasible=document.feasible,
        sanitization_rows=(),
        chain_months=document.chain_months,
        store_plans=document.store_plans,
    )
    with pytest.raises(ValueError, match="sanitization rows"):
        build_excel_report(empty)
