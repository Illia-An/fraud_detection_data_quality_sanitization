"""Lower-is-better TTS allocation. Thin wrapper over ``planner.allocate``.

Working bounds: see ``planner.tts_bounds`` (single source until product lock).
"""

from __future__ import annotations

from dataclasses import dataclass

from planner.allocate import allocate_plan
from planner.plan_types import MonthScore, StoreProjection
from planner.tts_bounds import (
    TTS_CEILING_MIN,
    TTS_DEFAULT_MAX_MONTHLY_IMPROVE,
    TTS_FLOOR_MIN,
)

__all__ = [
    "MonthScore",
    "StoreProjection",
    "TtsPlanResult",
    "plan_tts",
]


@dataclass(frozen=True)
class TtsPlanResult:
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


def plan_tts(
    *,
    baseline: dict[int, float],
    target: float,
    n_months: int,
    max_monthly_improve: float = TTS_DEFAULT_MAX_MONTHLY_IMPROVE,
    priority_power: float = 1.0,
    trajectory: str = "uniform",
    trajectory_power: float = 2.0,
    growth_factor: float = 0.5,
    reference_year: int,
    reference_month: int,
    floor: float = TTS_FLOOR_MIN,
    ceiling: float = TTS_CEILING_MIN,
) -> TtsPlanResult:
    """Allocate store×month minute reductions toward a chain target."""
    result = allocate_plan(
        baseline=baseline,
        target=target,
        n_months=n_months,
        direction="lower_is_better",
        metric_id="tts",
        unit="min",
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
    return TtsPlanResult(
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
