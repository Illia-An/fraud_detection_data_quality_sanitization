"""HTTP body for the Excel report. Mapping into the pure document lives here."""

from __future__ import annotations

from pydantic import BaseModel, Field

from excel_report.document import (
    ExcelReportDocument,
    PlanMonthScore,
    SanitizationScoreRow,
    StorePlanMonths,
)


class SanitizationScoreIn(BaseModel):
    store_id: int
    year: int
    month: int = Field(ge=1, le=12)
    score: float


class PlanMonthIn(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    score: float


class StorePlanIn(BaseModel):
    store_id: int
    months: list[PlanMonthIn] = Field(min_length=1)


class ExcelReportRequest(BaseModel):
    method: str = Field(min_length=1, max_length=200)
    period_start: str | None = None
    period_end: str | None = None
    target: float
    current_chain: float
    final_chain: float
    feasible: bool
    sanitization_rows: list[SanitizationScoreIn] = Field(min_length=1)
    chain_months: list[PlanMonthIn] = Field(min_length=1)
    store_plans: list[StorePlanIn] = Field(min_length=1)


def to_excel_report_document(body: ExcelReportRequest) -> ExcelReportDocument:
    return ExcelReportDocument(
        method=body.method,
        period_start=body.period_start,
        period_end=body.period_end,
        target=body.target,
        current_chain=body.current_chain,
        final_chain=body.final_chain,
        feasible=body.feasible,
        sanitization_rows=tuple(
            SanitizationScoreRow(
                store_id=row.store_id,
                year=row.year,
                month=row.month,
                score=row.score,
            )
            for row in body.sanitization_rows
        ),
        chain_months=tuple(
            PlanMonthScore(year=point.year, month=point.month, score=point.score)
            for point in body.chain_months
        ),
        store_plans=tuple(
            StorePlanMonths(
                store_id=store.store_id,
                months=tuple(
                    PlanMonthScore(year=point.year, month=point.month, score=point.score)
                    for point in store.months
                ),
            )
            for store in body.store_plans
        ),
    )
