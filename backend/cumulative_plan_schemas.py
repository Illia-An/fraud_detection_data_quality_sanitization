"""HTTP contracts for cumulative-slope plan versions & simulation (SPEC-P001)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from planner.cumulative_slope.plan_version import (
    PlanVersion,
    PlanVersionListItem,
    overlay_frozen_baseline,
)
from planner.cumulative_slope.types import (
    NetworkPlanParams,
    SimulationResult,
    StoreCurves,
    StoreMonthFact,
    UnreachableHint,
    YearMonth,
)


class YearMonthIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)

    def to_domain(self) -> YearMonth:
        return YearMonth(year=self.year, month=self.month)


class StoreMonthFactIn(BaseModel):
    store_id: int
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    five_percent: float = Field(ge=0.0, le=100.0)

    def to_domain(self) -> StoreMonthFact:
        return StoreMonthFact(
            store_id=self.store_id,
            year=self.year,
            month=self.month,
            five_percent=self.five_percent,
        )


class NetworkPlanParamsIn(BaseModel):
    history_cap_mode: Literal["max_mom", "p95_mom", "best_window"] = "max_mom"
    plateau_ahead_pp: float = Field(default=2.0, ge=0.0)
    mild_rate: float = Field(default=0.5, ge=0.0)
    boost_gain: float = Field(default=0.15, ge=0.0)
    min_history_cap: float = Field(default=0.25, ge=0.0)
    floor: float = Field(default=0.0, ge=0.0)
    ceiling: float = Field(default=100.0, ge=0.0, le=100.0)

    def to_domain(self) -> NetworkPlanParams:
        return NetworkPlanParams(
            history_cap_mode=self.history_cap_mode,
            plateau_ahead_pp=self.plateau_ahead_pp,
            mild_rate=self.mild_rate,
            boost_gain=self.boost_gain,
            min_history_cap=self.min_history_cap,
            floor=self.floor,
            ceiling=self.ceiling,
        )


class PlanVersionCreateRequest(BaseModel):
    label: str | None = None
    network_target: float = Field(default=75.0, ge=0.0, le=100.0)
    as_of: YearMonthIn
    planning_year: int = Field(ge=2000, le=2100)
    cumulative_start: YearMonthIn = Field(default_factory=lambda: YearMonthIn(year=2025, month=1))
    solver: Literal["cumulative_slope"] = "cumulative_slope"
    params: NetworkPlanParamsIn = Field(default_factory=NetworkPlanParamsIn)
    facts: list[StoreMonthFactIn] = Field(min_length=1)

    @model_validator(mode="after")
    def _reject_empty_label_whitespace(self) -> PlanVersionCreateRequest:
        if self.label is not None and not self.label.strip():
            self.label = None
        return self


class SimulationRequest(BaseModel):
    network_target: float = Field(default=75.0, ge=0.0, le=100.0)
    as_of: YearMonthIn
    planning_year: int = Field(ge=2000, le=2100)
    cumulative_start: YearMonthIn = Field(default_factory=lambda: YearMonthIn(year=2025, month=1))
    solver: Literal["cumulative_slope"] = "cumulative_slope"
    params: NetworkPlanParamsIn = Field(default_factory=NetworkPlanParamsIn)
    active_plan_version_id: str | None = None
    facts: list[StoreMonthFactIn] = Field(min_length=1)


class StoreAdjustmentIn(BaseModel):
    store_id: int
    new_implied_target: float = Field(ge=0.0, le=100.0)


class SimulationAdjustRequest(SimulationRequest):
    adjustments: list[StoreAdjustmentIn] = Field(min_length=1)


class MonthScoreOut(BaseModel):
    year: int
    month: int
    score: float


class YearMonthOut(BaseModel):
    year: int
    month: int


class NetworkPlanParamsOut(BaseModel):
    history_cap_mode: str
    plateau_ahead_pp: float
    mild_rate: float
    boost_gain: float
    min_history_cap: float
    floor: float
    ceiling: float


class PlanVersionMetaOut(BaseModel):
    id: str
    created_at: str
    label: str | None
    metric_id: str
    direction: str
    solver: str
    network_target: float
    as_of: YearMonthOut
    planning_year: int
    cumulative_start: YearMonthOut
    network_mean_at_save: float
    params: NetworkPlanParamsOut


class PlanVersionStoreRowOut(BaseModel):
    store_id: int
    monthly_target: list[MonthScoreOut]
    implied_target: float
    cumulative_planned: list[MonthScoreOut]


class PlanVersionOut(BaseModel):
    meta: PlanVersionMetaOut
    stores: list[PlanVersionStoreRowOut]
    network_monthly_target: list[MonthScoreOut]
    network_cumulative_planned: list[MonthScoreOut]


class PlanVersionListItemOut(BaseModel):
    id: str
    created_at: str
    label: str | None
    network_target: float
    as_of: YearMonthOut
    planning_year: int
    solver: str
    network_mean_at_save: float
    store_count: int
    metric_id: str = "five_percent"


class PlanVersionListOut(BaseModel):
    items: list[PlanVersionListItemOut]


class NetworkSummaryOut(BaseModel):
    network_target: float
    network_mean_as_of: float
    projected_network_mean_eoy: float
    feasible: bool
    store_count: int


class StoreCurvesOut(BaseModel):
    store_id: int
    monthly_target: list[MonthScoreOut]
    cumulative_planned: list[MonthScoreOut]
    actual: list[MonthScoreOut]
    cumulative_actual: list[MonthScoreOut]
    simulation: list[MonthScoreOut]
    cumulative_actual_or_simulation: list[MonthScoreOut]
    implied_target: float
    gap_to_mean: float
    slope: float
    unreachable: bool
    suggested_implied_target: float | None
    capped: bool


class UnreachableHintOut(BaseModel):
    store_id: int
    implied_target: float
    suggested_implied_target: float
    reason: str
    network_impact_pp: float


class SimulationOut(BaseModel):
    as_of: YearMonthOut
    planning_year: int
    active_plan_version_id: str | None
    network: NetworkSummaryOut
    stores: list[StoreCurvesOut]
    unreachable: list[UnreachableHintOut]


def _ms_out(m) -> MonthScoreOut:
    return MonthScoreOut(year=m.year, month=m.month, score=m.score)


def _ym_out(ym: YearMonth) -> YearMonthOut:
    return YearMonthOut(year=ym.year, month=ym.month)


def plan_version_to_out(version: PlanVersion) -> PlanVersionOut:
    p = version.meta.params
    return PlanVersionOut(
        meta=PlanVersionMetaOut(
            id=version.meta.id,
            created_at=version.meta.created_at,
            label=version.meta.label,
            metric_id=version.meta.metric_id,
            direction=version.meta.direction,
            solver=version.meta.solver,
            network_target=version.meta.network_target,
            as_of=_ym_out(version.meta.as_of),
            planning_year=version.meta.planning_year,
            cumulative_start=_ym_out(version.meta.cumulative_start),
            network_mean_at_save=version.meta.network_mean_at_save,
            params=NetworkPlanParamsOut(
                history_cap_mode=p.history_cap_mode,
                plateau_ahead_pp=p.plateau_ahead_pp,
                mild_rate=p.mild_rate,
                boost_gain=p.boost_gain,
                min_history_cap=p.min_history_cap,
                floor=p.floor,
                ceiling=p.ceiling,
            ),
        ),
        stores=[
            PlanVersionStoreRowOut(
                store_id=s.store_id,
                monthly_target=[_ms_out(m) for m in s.monthly_target],
                implied_target=s.implied_target,
                cumulative_planned=[_ms_out(m) for m in s.cumulative_planned],
            )
            for s in version.stores
        ],
        network_monthly_target=[_ms_out(m) for m in version.network_monthly_target],
        network_cumulative_planned=[_ms_out(m) for m in version.network_cumulative_planned],
    )


def list_item_to_out(item: PlanVersionListItem) -> PlanVersionListItemOut:
    return PlanVersionListItemOut(
        id=item.id,
        created_at=item.created_at,
        label=item.label,
        network_target=item.network_target,
        as_of=_ym_out(item.as_of),
        planning_year=item.planning_year,
        solver=item.solver,
        network_mean_at_save=item.network_mean_at_save,
        store_count=item.store_count,
        metric_id=item.metric_id,
    )


def _store_curves_out(s: StoreCurves) -> StoreCurvesOut:
    return StoreCurvesOut(
        store_id=s.store_id,
        monthly_target=[_ms_out(m) for m in s.monthly_target],
        cumulative_planned=[_ms_out(m) for m in s.cumulative_planned],
        actual=[_ms_out(m) for m in s.actual],
        cumulative_actual=[_ms_out(m) for m in s.cumulative_actual],
        simulation=[_ms_out(m) for m in s.simulation],
        cumulative_actual_or_simulation=[_ms_out(m) for m in s.cumulative_actual_or_simulation],
        implied_target=s.implied_target,
        gap_to_mean=s.gap_to_mean,
        slope=s.slope,
        unreachable=s.unreachable,
        suggested_implied_target=s.suggested_implied_target,
        capped=s.capped,
    )


def _hint_out(h: UnreachableHint) -> UnreachableHintOut:
    return UnreachableHintOut(
        store_id=h.store_id,
        implied_target=h.implied_target,
        suggested_implied_target=h.suggested_implied_target,
        reason=h.reason,
        network_impact_pp=h.network_impact_pp,
    )


def simulation_to_out(
    result: SimulationResult,
    *,
    active_plan_version_id: str | None,
) -> SimulationOut:
    return SimulationOut(
        as_of=_ym_out(result.as_of),
        planning_year=result.planning_year,
        active_plan_version_id=active_plan_version_id,
        network=NetworkSummaryOut(
            network_target=result.network.network_target,
            network_mean_as_of=result.network.network_mean_as_of,
            projected_network_mean_eoy=result.network.projected_network_mean_eoy,
            feasible=result.network.feasible,
            store_count=result.network.store_count,
        ),
        stores=[_store_curves_out(s) for s in result.stores],
        unreachable=[_hint_out(h) for h in result.unreachable],
    )


def maybe_overlay(
    result: SimulationResult,
    version: PlanVersion | None,
) -> SimulationResult:
    if version is None:
        return result
    return overlay_frozen_baseline(result, version)
