"""Lower-is-better TTS allocation. Mirror of ``plan_five_percent``.

Baseline values are monthly ``TTS`` minutes (equal store weights). A step
subtracts minutes. Stores slower than the target (higher minutes) take
priority. Stores already faster than the target may edge toward ``floor``.

Working bounds until the product lock replaces them: floor 0 min, ceiling
30 min, max monthly step 0.25 min. The source table is read-only; this
function does not touch a database.
"""

from __future__ import annotations

from dataclasses import dataclass

from planner.five_percent import (
    MonthScore,
    StoreProjection,
    add_calendar_months,
    trajectory_weights,
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
    max_monthly_improve: float = 0.25,
    priority_power: float = 1.0,
    trajectory: str = "uniform",
    trajectory_power: float = 2.0,
    growth_factor: float = 0.5,
    reference_year: int,
    reference_month: int,
    floor: float = 0.0,
    ceiling: float = 30.0,
) -> TtsPlanResult:
    """Allocate store×month minute reductions toward a chain target.

    Baseline values are TTS minutes at the reference month.
    Equal store weights (same lock as the five_percent planner).
    """
    if not baseline:
        raise ValueError("baseline must contain at least one store")
    if not (1 <= reference_month <= 12):
        raise ValueError("reference_month must be 1..12")
    if n_months < 1 or n_months > 12:
        raise ValueError("n_months must be 1..12")
    if max_monthly_improve < 0.01:
        raise ValueError("max_monthly_improve must be >= 0.01")
    if priority_power < 0.1:
        raise ValueError("priority_power must be >= 0.1")
    if not (0.0 <= growth_factor <= 1.0):
        raise ValueError("growth_factor must be in [0, 1]")
    if floor >= ceiling:
        raise ValueError("floor must be below ceiling")
    if target < floor or target > ceiling:
        raise ValueError(f"target must be within [{floor}, {ceiling}]")

    store_ids = sorted(baseline.keys())
    n = len(store_ids)
    weight = 1.0 / n
    scores = {sid: float(baseline[sid]) for sid in store_ids}
    current_chain = sum(scores.values()) / n
    if target > current_chain + 1e-9:
        raise ValueError(
            "Target must improve in the selected metric direction "
            f"(current chain {current_chain:.4f} min, target {target:.4f} min)."
        )
    required = max(0.0, current_chain - target)

    capacity: dict[int, float] = {}
    priority: dict[int, float] = {}
    for sid in store_ids:
        value = scores[sid]
        gap = max(0.0, value - target)
        if gap > 0:
            cap = min(gap, max_monthly_improve * n_months)
            pri = weight * (gap**priority_power)
        else:
            room = max(0.0, value - floor)
            proximity = 1.0 - min(1.0, (target - value) / max(target - floor, 1e-9))
            cap = min(room * proximity * growth_factor, max_monthly_improve * n_months)
            pri = weight * proximity * room * 0.3
        capacity[sid] = max(0.0, cap)
        priority[sid] = max(0.0, pri)

    totals = {sid: 0.0 for sid in store_ids}
    if required > 1e-12 and sum(capacity.values()) > 1e-12:
        denom = sum(weight * priority[sid] for sid in store_ids)
        if denom <= 0:
            capable = [sid for sid in store_ids if capacity[sid] > 0]
            if capable:
                share = required / (weight * len(capable))
                for sid in capable:
                    totals[sid] = min(capacity[sid], share)
        else:
            for sid in store_ids:
                totals[sid] = min(capacity[sid], priority[sid] * (required / denom))

        for _ in range(40):
            achieved = sum(weight * totals[sid] for sid in store_ids)
            remaining_needed = required - achieved
            if remaining_needed <= 1e-8:
                break
            rem_cap = {
                sid: max(0.0, capacity[sid] - totals[sid]) for sid in store_ids
            }
            if sum(rem_cap.values()) <= 1e-12:
                break
            alloc_pri = {sid: weight * rem_cap[sid] for sid in store_ids}
            denom2 = sum(weight * alloc_pri[sid] for sid in store_ids)
            if denom2 <= 0:
                break
            for sid in store_ids:
                add = alloc_pri[sid] * (remaining_needed / denom2)
                add = min(add, rem_cap[sid])
                totals[sid] += add

    month_weights = trajectory_weights(n_months, trajectory, trajectory_power)
    periods = [
        add_calendar_months(reference_year, reference_month, i + 1)
        for i in range(n_months)
    ]

    current = dict(scores)
    chain_traj: list[MonthScore] = []
    store_month_scores: dict[int, list[MonthScore]] = {sid: [] for sid in store_ids}

    for mi, (year, month) in enumerate(periods):
        w_m = month_weights[mi]
        for sid in store_ids:
            desired = totals[sid] * w_m
            room = max(0.0, current[sid] - floor)
            take = min(desired, max_monthly_improve, room)
            current[sid] = min(ceiling, max(floor, current[sid] - take))
            store_month_scores[sid].append(
                MonthScore(year=year, month=month, score=round(current[sid], 4))
            )
        chain = sum(current.values()) / n
        chain_traj.append(MonthScore(year=year, month=month, score=round(chain, 4)))

    final_chain = chain_traj[-1].score if chain_traj else current_chain
    feasible = final_chain <= target + 1e-8 or required <= 1e-8

    projections = tuple(
        StoreProjection(store_id=sid, months=tuple(store_month_scores[sid]))
        for sid in store_ids
    )
    return TtsPlanResult(
        metric_id="tts",
        unit="min",
        direction="lower_is_better",
        target=target,
        current_chain=round(current_chain, 4),
        required_change=round(required, 4),
        final_chain=round(final_chain, 4),
        chain_trajectory=tuple(chain_traj),
        projections=projections,
        feasible=feasible,
    )
