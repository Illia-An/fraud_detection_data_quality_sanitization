"""HTTP body for the Excel report. Mapping into the pure document lives here."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from excel_report.document import (
    ExcelReportDocument,
    PlanMonthScore,
    PlanVersionContext,
    SanitizationScoreRow,
    StoreMonthMatrix,
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


class StoreMonthMatrixIn(BaseModel):
    store_id: int
    monthly_target: list[float | None] = Field(min_length=12, max_length=12)
    cumulative_planned: list[float | None] = Field(min_length=12, max_length=12)
    actual: list[float | None] = Field(min_length=12, max_length=12)
    cumulative_actual_or_simulation: list[float | None] = Field(
        min_length=12, max_length=12
    )


class PlanVersionContextIn(BaseModel):
    version_id: str | None = None
    created_at: str | None = None
    label: str | None = None
    network_target: float | None = None
    as_of_year: int | None = None
    as_of_month: int | None = Field(default=None, ge=1, le=12)
    planning_year: int | None = None
    network_mean_at_save: float | None = None


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
    store_matrices: list[StoreMonthMatrixIn] = Field(default_factory=list)
    plan_version: PlanVersionContextIn | None = None

    @field_validator("store_matrices")
    @classmethod
    def _matrices_optional(cls, value: list[StoreMonthMatrixIn]) -> list[StoreMonthMatrixIn]:
        return value


def to_excel_report_document(body: ExcelReportRequest) -> ExcelReportDocument:
    plan_version = None
    if body.plan_version is not None:
        pv = body.plan_version
        plan_version = PlanVersionContext(
            version_id=pv.version_id,
            created_at=pv.created_at,
            label=pv.label,
            network_target=pv.network_target,
            as_of_year=pv.as_of_year,
            as_of_month=pv.as_of_month,
            planning_year=pv.planning_year,
            network_mean_at_save=pv.network_mean_at_save,
        )
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
        store_matrices=tuple(
            StoreMonthMatrix(
                store_id=row.store_id,
                monthly_target=tuple(row.monthly_target),
                cumulative_planned=tuple(row.cumulative_planned),
                actual=tuple(row.actual),
                cumulative_actual_or_simulation=tuple(row.cumulative_actual_or_simulation),
            )
            for row in body.store_matrices
        ),
        plan_version=plan_version,
    )
