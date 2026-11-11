"""Finished sanitization + plan handed to the Excel report. No I/O."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SanitizationScoreRow:
    store_id: int
    year: int
    month: int
    score: float


@dataclass(frozen=True)
class PlanMonthScore:
    year: int
    month: int
    score: float


@dataclass(frozen=True)
class StorePlanMonths:
    store_id: int
    months: tuple[PlanMonthScore, ...]


@dataclass(frozen=True)
class StoreMonthMatrix:
    """Planning-year months 1..12 metric rows for one store (SPEC-P001 D-09).

    Missing months are None (e.g. future actuals).
    """

    store_id: int
    monthly_target: tuple[float | None, ...]
    cumulative_planned: tuple[float | None, ...]
    actual: tuple[float | None, ...]
    cumulative_actual_or_simulation: tuple[float | None, ...]
    required_monthly: tuple[float | None, ...]
    required_cumulative: tuple[float | None, ...]

    def __post_init__(self) -> None:
        for name in (
            "monthly_target",
            "cumulative_planned",
            "actual",
            "cumulative_actual_or_simulation",
            "required_monthly",
            "required_cumulative",
        ):
            values = getattr(self, name)
            if len(values) != 12:
                raise ValueError(f"{name} must have exactly 12 month slots")


@dataclass(frozen=True)
class PlanVersionContext:
    """Baseline version metadata for Plan vs Actual vs Forecast compare."""

    version_id: str | None
    created_at: str | None
    label: str | None
    network_target: float | None
    as_of_year: int | None
    as_of_month: int | None
    planning_year: int | None
    network_mean_at_save: float | None


@dataclass(frozen=True)
class ExcelReportDocument:
    """One report. Scores are copied as given; this module does not recompute them."""

    method: str
    period_start: str | None
    period_end: str | None
    target: float
    current_chain: float
    final_chain: float
    feasible: bool
    sanitization_rows: tuple[SanitizationScoreRow, ...]
    chain_months: tuple[PlanMonthScore, ...]
    store_plans: tuple[StorePlanMonths, ...]
    store_matrices: tuple[StoreMonthMatrix, ...] = ()
    plan_version: PlanVersionContext | None = None
