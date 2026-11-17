"""Simplified higher-is-better five_percent allocation (TASK-15 Phase A).

Inspired by store-score-allocation ``StorePlanner`` but stdlib-only and
five_percent-only. Core math lives in ``planner.allocate`` (Wave 8).
"""

from __future__ import annotations

from dataclasses import dataclass

from planner.allocate import allocate_plan
from planner.plan_types import MonthScore, StoreProjection
from planner.schedule import add_calendar_months, trajectory_weights

# Old import paths (MonthScore, StoreProjection, trajectory_weights,
# add_calendar_months) stay valid via these re-exports.
__all__ = [
    "FivePercentPlanResult",
    "MonthScore",
    "StoreProjection",
    "add_calendar_months",
    "plan_five_percent",
    "trajectory_weights",
]


@dataclass(frozen=True)
class FivePercentPlanResult:
    metric_id: str
    unit: str
    direction: str
    target: float
    current_chain: float
    required_change: float
    final_chain: float
    chain_trajectory: tuple[MonthScore, ...]
    projections: tuple[StoreProjection, ...]
    feasible: bool


def plan_five_percent(
    *,
    baseline: dict[int, float],
    target: float,
    n_months: int,
    max_monthly_improve: float = 4.0,
    priority_power: float = 1.0,
    trajectory: str = "uniform",
    trajectory_power: float = 2.0,
    growth_factor: float = 0.5,
    reference_year: int,
    reference_month: int,
    floor: float = 0.0,
    ceiling: float = 100.0,
) -> FivePercentPlanResult:
    """Allocate store×month score improvements toward a chain target.

    Baseline values are cleansed five_percent at the reference month.
    Equal store weights (product lock: no volume influence yet).
    """
    result = allocate_plan(
        baseline=baseline,
        target=target,
        n_months=n_months,
        direction="higher_is_better",
        metric_id="five_percent",
        unit="%",
        max_monthly_improve=max_monthly_improve,
        priority_power=priority_power,
        trajectory=trajectory,
        trajectory_power=trajectory_power,
        growth_factor=growth_factor,
        reference_year=reference_year,
        reference_month=reference_month,
        floor=floor,
        ceiling=ceiling,
    )
    return FivePercentPlanResult(
        metric_id=result.metric_id,
        unit=result.unit,
        direction=result.direction,
        target=result.target,
        current_chain=result.current_chain,
        required_change=result.required_change,
        final_chain=result.final_chain,
        chain_trajectory=result.chain_trajectory,
        projections=result.projections,
        feasible=result.feasible,
    )
