"""Cumulative-slope planner (SPEC-P001) — Survey higher-is-better."""

from planner.cumulative_slope.engine import build_baseline_plan, simulate
from planner.cumulative_slope.mean import equal_weight_mean
from planner.cumulative_slope.types import (
    MonthScore,
    NetworkPlanParams,
    NetworkSummary,
    SimulationResult,
    StoreCurves,
    StoreMonthFact,
    UnreachableHint,
    YearMonth,
)

__all__ = [
    "MonthScore",
    "NetworkPlanParams",
    "NetworkSummary",
    "SimulationResult",
    "StoreCurves",
    "StoreMonthFact",
    "UnreachableHint",
    "YearMonth",
    "build_baseline_plan",
    "equal_weight_mean",
    "simulate",
]
