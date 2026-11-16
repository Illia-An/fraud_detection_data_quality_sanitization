"""Five-percent / TTS plans, plan versions, and simulation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.app_common import API_PREFIX, plan_store
from backend.cumulative_plan_schemas import (
    PlanVersionCreateRequest,
    PlanVersionListOut,
    PlanVersionOut,
    SimulationAdjustRequest,
    SimulationOut,
    SimulationRequest,
    list_item_to_out,
    maybe_overlay,
    plan_version_to_out,
    simulation_to_out,
)
from backend.plan_schemas import (
    FivePercentPlanOut,
    MonthScoreOut,
    PlanRequest,
    PlanResponse,
    StoreProjectionOut,
)
from backend.tts_plan_schemas import (
    TtsPlanBoundsOut,
    TtsPlanOut,
    TtsPlanRequest,
    TtsPlanResponse,
)
from planner.cumulative_slope import build_baseline_plan, simulate
from planner.cumulative_slope.plan_version import build_plan_version
from planner.five_percent import plan_five_percent
from planner.tts import plan_tts
from planner.tts_bounds import tts_bounds_payload

router = APIRouter(prefix=API_PREFIX)


@router.get(
    "/plans-tts/bounds",
    response_model=TtsPlanBoundsOut,
    tags=["plans-tts"],
)
def tts_plan_bounds() -> TtsPlanBoundsOut:
    """Working TTS planner bounds (single backend source for FE / clients)."""
    return TtsPlanBoundsOut.model_validate(tts_bounds_payload())


@router.post(
    "/plans",
    response_model=PlanResponse,
    tags=["plans"],
    responses={422: {"description": "Validation error"}},
)
def create_plan(body: PlanRequest) -> PlanResponse:
    """Allocate five_percent store×month projections from a cleansed baseline."""
    try:
        baseline = {row.store_id: row.five_percent for row in body.baseline_rows}
        result = plan_five_percent(
            baseline=baseline,
            target=body.target,
            n_months=body.horizon,
            max_monthly_improve=body.params.max_monthly_improve,
            priority_power=body.params.priority_power,
            trajectory=body.params.trajectory,
            trajectory_power=body.params.trajectory_power,
            growth_factor=body.params.growth_factor,
            reference_year=body.reference_year,
            reference_month=body.reference_month,
        )
        metric = FivePercentPlanOut(
            target=result.target,
            current_chain=result.current_chain,
            required_change=result.required_change,
            final_chain=result.final_chain,
            feasible=result.feasible,
            chain_trajectory=[
                MonthScoreOut(year=m.year, month=m.month, score=m.score)
                for m in result.chain_trajectory
            ],
            projections=[
                StoreProjectionOut(
                    store_id=p.store_id,
                    months=[
                        MonthScoreOut(year=m.year, month=m.month, score=m.score)
                        for m in p.months
                    ],
                )
                for p in result.projections
            ],
        )
        return PlanResponse(metrics={"five_percent": metric})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/plans-tts",
    response_model=TtsPlanResponse,
    tags=["plans-tts"],
    responses={422: {"description": "Validation error"}},
)
def create_tts_plan(body: TtsPlanRequest) -> TtsPlanResponse:
    """Allocate TTS store×month minute reductions from a KPI baseline snapshot."""
    try:
        baseline = {row.store_id: row.tts for row in body.baseline_rows}
        result = plan_tts(
            baseline=baseline,
            target=body.target,
            n_months=body.horizon,
            max_monthly_improve=body.params.max_monthly_improve,
            priority_power=body.params.priority_power,
            trajectory=body.params.trajectory,
            trajectory_power=body.params.trajectory_power,
            growth_factor=body.params.growth_factor,
            reference_year=body.reference_year,
            reference_month=body.reference_month,
        )
        metric = TtsPlanOut(
            target=result.target,
            current_chain=result.current_chain,
            required_change=result.required_change,
            final_chain=result.final_chain,
            feasible=result.feasible,
            chain_trajectory=[
                MonthScoreOut(year=m.year, month=m.month, score=m.score)
                for m in result.chain_trajectory
            ],
            projections=[
                StoreProjectionOut(
                    store_id=p.store_id,
                    months=[
                        MonthScoreOut(year=m.year, month=m.month, score=m.score)
                        for m in p.months
                    ],
                )
                for p in result.projections
            ],
        )
        return TtsPlanResponse(metrics={"tts": metric})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/plan-versions",
    response_model=PlanVersionOut,
    status_code=201,
    tags=["plan-versions"],
    responses={422: {"description": "Validation error"}},
)
def create_plan_version(body: PlanVersionCreateRequest) -> PlanVersionOut:
    """Compute and persist an immutable Baseline Plan version."""
    try:
        params = body.params.to_domain()
        cumulative_start = body.cumulative_start.to_domain()
        result = build_baseline_plan(
            facts=[f.to_domain() for f in body.facts],
            network_target=body.network_target,
            as_of=body.as_of.to_domain(),
            planning_year=body.planning_year,
            cumulative_start=cumulative_start,
            params=params,
        )
        version = build_plan_version(
            result,
            cumulative_start=cumulative_start,
            params=params,
            label=body.label,
        )
        saved = plan_store().insert(version)
        return plan_version_to_out(saved)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/plan-versions",
    response_model=PlanVersionListOut,
    tags=["plan-versions"],
)
def list_plan_versions(
    limit: int = Query(default=50, ge=1, le=200),
    metric_id: str = Query(default="five_percent"),
) -> PlanVersionListOut:
    items = plan_store().list_versions(limit=limit, metric_id=metric_id)
    return PlanVersionListOut(items=[list_item_to_out(i) for i in items])


@router.get(
    "/plan-versions/{version_id}",
    response_model=PlanVersionOut,
    tags=["plan-versions"],
    responses={404: {"description": "Unknown plan version"}},
)
def get_plan_version(version_id: str) -> PlanVersionOut:
    version = plan_store().get(version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Plan version not found")
    return plan_version_to_out(version)


@router.post(
    "/simulation",
    response_model=SimulationOut,
    tags=["simulation"],
    responses={
        404: {"description": "Unknown active plan version"},
        422: {"description": "Validation error"},
    },
)
def run_simulation(body: SimulationRequest) -> SimulationOut:
    """Live simulation from facts; optional frozen blue overlay from a plan version."""
    store = plan_store()
    frozen = None
    if body.active_plan_version_id:
        frozen = store.get(body.active_plan_version_id)
        if frozen is None:
            raise HTTPException(status_code=404, detail="Plan version not found")
    try:
        result = simulate(
            facts=[f.to_domain() for f in body.facts],
            network_target=body.network_target,
            as_of=body.as_of.to_domain(),
            planning_year=body.planning_year,
            cumulative_start=body.cumulative_start.to_domain(),
            params=body.params.to_domain(),
        )
        result = maybe_overlay(result, frozen)
        return simulation_to_out(
            result, active_plan_version_id=body.active_plan_version_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/simulation/adjust",
    response_model=SimulationOut,
    tags=["simulation"],
    responses={
        404: {"description": "Unknown active plan version"},
        422: {"description": "Validation error"},
    },
)
def run_simulation_adjust(body: SimulationAdjustRequest) -> SimulationOut:
    """Re-simulate with limited store implied-target overrides (does not Save)."""
    store = plan_store()
    frozen = None
    if body.active_plan_version_id:
        frozen = store.get(body.active_plan_version_id)
        if frozen is None:
            raise HTTPException(status_code=404, detail="Plan version not found")
    overrides = {a.store_id: a.new_implied_target for a in body.adjustments}
    try:
        result = simulate(
            facts=[f.to_domain() for f in body.facts],
            network_target=body.network_target,
            as_of=body.as_of.to_domain(),
            planning_year=body.planning_year,
            cumulative_start=body.cumulative_start.to_domain(),
            params=body.params.to_domain(),
            implied_target_overrides=overrides,
        )
        result = maybe_overlay(result, frozen)
        return simulation_to_out(
            result, active_plan_version_id=body.active_plan_version_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
