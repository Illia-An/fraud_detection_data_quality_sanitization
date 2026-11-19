"""Cumulative-slope planner (SPEC-P001) — Survey higher-is-better."""

from planner.cumulative_slope.engine import build_baseline_plan, simulate
from planner.cumulative_slope.mean import equal_weight_mean
from planner.cumulative_slope.plan_version import (
    PlanVersion,
    apply_store_monthly_overrides,
    build_plan_version,
    overlay_frozen_baseline,
)
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
    "PlanVersion",
    "SimulationResult",
    "StoreCurves",
    "StoreMonthFact",
    "UnreachableHint",
    "YearMonth",
    "apply_store_monthly_overrides",
    "build_baseline_plan",
    "build_plan_version",
    "equal_weight_mean",
    "overlay_frozen_baseline",
    "simulate",
]
