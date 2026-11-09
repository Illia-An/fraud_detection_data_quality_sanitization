"""Excel report builder writes the given scores and does not recompute them."""

from __future__ import annotations

from io import BytesIO

import pytest
from openpyxl import load_workbook

from excel_report.document import (
    ExcelReportDocument,
    PlanMonthScore,
    SanitizationScoreRow,
    StorePlanMonths,
)
from excel_report.workbook import build_excel_report


def _document() -> ExcelReportDocument:
    return ExcelReportDocument(
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
