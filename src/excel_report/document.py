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
