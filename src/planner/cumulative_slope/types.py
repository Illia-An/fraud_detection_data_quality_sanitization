"""Domain types for cumulative-slope planner (SPEC-P001)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


HistoryCapMode = Literal["max_mom", "p95_mom", "best_window"]
SolverId = Literal["cumulative_slope", "legacy"]
UnreachableReason = Literal["above_period_100pct", "above_history_cap"]


@dataclass(frozen=True)
class YearMonth:
    year: int
    month: int

    def __post_init__(self) -> None:
        if not (1 <= self.month <= 12):
            raise ValueError("month must be 1..12")


@dataclass(frozen=True)
class MonthScore:
    year: int
    month: int
    score: float


@dataclass(frozen=True)
class StoreMonthFact:
    store_id: int
    year: int
    month: int
    five_percent: float


@dataclass(frozen=True)
class NetworkPlanParams:
    history_cap_mode: HistoryCapMode = "max_mom"
    plateau_ahead_pp: float = 2.0
    mild_rate: float = 0.5
    boost_gain: float = 0.15
    min_history_cap: float = 0.25
    floor: float = 0.0
    ceiling: float = 100.0


@dataclass(frozen=True)
class UnreachableHint:
    store_id: int
    implied_target: float
    suggested_implied_target: float
    reason: UnreachableReason
    network_impact_pp: float


@dataclass(frozen=True)
class StoreCurves:
    store_id: int
    monthly_target: tuple[MonthScore, ...]
    cumulative_planned: tuple[MonthScore, ...]
    actual: tuple[MonthScore, ...]
    cumulative_actual: tuple[MonthScore, ...]
    simulation: tuple[MonthScore, ...]
    cumulative_actual_or_simulation: tuple[MonthScore, ...]
    implied_target: float
    gap_to_mean: float
    slope: float
    unreachable: bool
    suggested_implied_target: float | None
    capped: bool


@dataclass(frozen=True)
class NetworkSummary:
    network_target: float
    network_mean_as_of: float
    projected_network_mean_eoy: float
    feasible: bool
    store_count: int


@dataclass(frozen=True)
class SimulationResult:
    as_of: YearMonth
    planning_year: int
    network: NetworkSummary
    stores: tuple[StoreCurves, ...]
    unreachable: tuple[UnreachableHint, ...]
