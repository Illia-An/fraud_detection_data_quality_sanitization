"""Simplified higher-is-better five_percent allocation (TASK-15 Phase A).

Inspired by store-score-allocation ``StorePlanner`` but stdlib-only and
five_percent-only. Good enough for React Planner heatmap experiment.
"""

from __future__ import annotations

from dataclasses import dataclass


def trajectory_weights(
    n_months: int,
    mode: str = "uniform",
    power: float = 2.0,
) -> list[float]:
    if n_months < 1:
        raise ValueError("n_months must be >= 1")
    months = list(range(1, n_months + 1))
    if mode == "uniform":
        raw = [1.0] * n_months
    elif mode == "front_loaded":
        raw = [float((n_months - m + 1) ** power) for m in months]
    elif mode == "accelerated":
        raw = [float(m**power) for m in months]
    else:
        raise ValueError("mode must be uniform|front_loaded|accelerated")
    total = sum(raw)
    return [w / total for w in raw]


def add_calendar_months(year: int, month: int, offset: int) -> tuple[int, int]:
    """Return (year, month) offset months after the given calendar month (1-based)."""
    idx = year * 12 + (month - 1) + offset
    return idx // 12, idx % 12 + 1


@dataclass(frozen=True)
class MonthScore:
    year: int
    month: int
    score: float


@dataclass(frozen=True)
class StoreProjection:
    store_id: int
    months: tuple[MonthScore, ...]


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
    Equal store weights (matches allocation SQL/API prepare path).
    """
    if not baseline:
        raise ValueError("baseline must contain at least one store")
    if not (1 <= reference_month <= 12):
        raise ValueError("reference_month must be 1..12")
    if n_months < 1 or n_months > 60:
        raise ValueError("n_months must be 1..60")
    if max_monthly_improve < 0.01:
        raise ValueError("max_monthly_improve must be >= 0.01")
    if priority_power < 0.1:
        raise ValueError("priority_power must be >= 0.1")
    if not (0.0 <= growth_factor <= 1.0):
        raise ValueError("growth_factor must be in [0, 1]")
    if target < floor or target > ceiling:
        raise ValueError(f"target must be within [{floor}, {ceiling}]")

    store_ids = sorted(baseline.keys())
    n = len(store_ids)
    weight = 1.0 / n
    scores = {sid: float(baseline[sid]) for sid in store_ids}
    current_chain = sum(scores.values()) / n
    required = max(0.0, target - current_chain)

    capacity: dict[int, float] = {}
    priority: dict[int, float] = {}
    for sid in store_ids:
        value = scores[sid]
        gap = max(0.0, target - value)
        if gap > 0:
            cap = min(gap, max_monthly_improve * n_months)
            pri = weight * (gap**priority_power)
        else:
            room = max(0.0, ceiling - value)
            proximity = 1.0 - min(1.0, (value - target) / max(ceiling - target, 1e-9))
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

        # Redistribute remaining chain need among stores with leftover capacity.
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
            room = max(0.0, ceiling - current[sid])
            take = min(desired, max_monthly_improve, room)
            current[sid] = min(ceiling, max(floor, current[sid] + take))
            store_month_scores[sid].append(
                MonthScore(year=year, month=month, score=round(current[sid], 4))
            )
        chain = sum(current.values()) / n
        chain_traj.append(MonthScore(year=year, month=month, score=round(chain, 4)))

    final_chain = chain_traj[-1].score if chain_traj else current_chain
    feasible = final_chain + 1e-8 >= target or required <= 1e-8

    projections = tuple(
        StoreProjection(store_id=sid, months=tuple(store_month_scores[sid]))
        for sid in store_ids
    )
    return FivePercentPlanResult(
        metric_id="five_percent",
        unit="%",
        direction="higher_is_better",
        target=target,
        current_chain=round(current_chain, 4),
        required_change=round(required, 4),
        final_chain=round(final_chain, 4),
        chain_trajectory=tuple(chain_traj),
        projections=projections,
        feasible=feasible,
    )
