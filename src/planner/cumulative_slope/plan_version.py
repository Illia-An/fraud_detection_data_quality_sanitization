"""PlanVersion snapshot built from a SimulationResult (SPEC-P001 D-07)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from planner.cumulative_slope.mean import equal_weight_mean
from planner.cumulative_slope.types import (
    MonthScore,
    NetworkPlanParams,
    SimulationResult,
    StoreCurves,
    YearMonth,
)


@dataclass(frozen=True)
class PlanVersionMeta:
    id: str
    created_at: str
    label: str | None
    metric_id: str
    direction: str
    solver: str
    network_target: float
    as_of: YearMonth
    planning_year: int
    cumulative_start: YearMonth
    network_mean_at_save: float
    params: NetworkPlanParams


@dataclass(frozen=True)
class PlanVersionStoreRow:
    store_id: int
    monthly_target: tuple[MonthScore, ...]
    implied_target: float
    cumulative_planned: tuple[MonthScore, ...]


@dataclass(frozen=True)
class PlanVersion:
    meta: PlanVersionMeta
    stores: tuple[PlanVersionStoreRow, ...]
    network_monthly_target: tuple[MonthScore, ...]
    network_cumulative_planned: tuple[MonthScore, ...]


@dataclass(frozen=True)
class PlanVersionListItem:
    id: str
    created_at: str
    label: str | None
    network_target: float
    as_of: YearMonth
    planning_year: int
    solver: str
    network_mean_at_save: float
    store_count: int
    metric_id: str = "five_percent"


def _ym_dict(ym: YearMonth) -> dict[str, int]:
    return {"year": ym.year, "month": ym.month}


def _ms_dict(ms: MonthScore) -> dict[str, float | int]:
    return {"year": ms.year, "month": ms.month, "score": ms.score}


def _ym_from(d: dict[str, Any]) -> YearMonth:
    return YearMonth(year=int(d["year"]), month=int(d["month"]))


def _ms_from(d: dict[str, Any]) -> MonthScore:
    return MonthScore(year=int(d["year"]), month=int(d["month"]), score=float(d["score"]))


def _params_from(d: dict[str, Any]) -> NetworkPlanParams:
    from dataclasses import fields

    allowed = {f.name for f in fields(NetworkPlanParams)}
    kwargs = {k: v for k, v in d.items() if k in allowed}
    return NetworkPlanParams(**kwargs)


def _network_series_from_stores(
    stores: tuple[PlanVersionStoreRow, ...],
) -> tuple[tuple[MonthScore, ...], tuple[MonthScore, ...]]:
    if not stores:
        return tuple(), tuple()
    # Align by (year, month) using first store's months as spine.
    spine = [(m.year, m.month) for m in stores[0].monthly_target]
    monthly: list[MonthScore] = []
    for year, month in spine:
        vals = []
        for row in stores:
            hit = next((m for m in row.monthly_target if m.year == year and m.month == month), None)
            if hit is None:
                raise ValueError(f"store {row.store_id} missing month {year}-{month}")
            vals.append(hit.score)
        monthly.append(MonthScore(year=year, month=month, score=round(equal_weight_mean(vals), 4)))
    running = 0.0
    cum: list[MonthScore] = []
    for i, ms in enumerate(monthly, start=1):
        running += ms.score
        cum.append(MonthScore(year=ms.year, month=ms.month, score=round(running / i, 4)))
    return tuple(monthly), tuple(cum)


def build_plan_version(
    result: SimulationResult,
    *,
    cumulative_start: YearMonth,
    params: NetworkPlanParams,
    label: str | None = None,
    version_id: str | None = None,
    created_at: str | None = None,
) -> PlanVersion:
    vid = version_id or str(uuid4())
    ts = created_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )
    stores = tuple(
        PlanVersionStoreRow(
            store_id=s.store_id,
            monthly_target=s.monthly_target,
            implied_target=s.implied_target,
            cumulative_planned=s.cumulative_planned,
        )
        for s in result.stores
    )
    net_m, net_c = _network_series_from_stores(stores)
    meta = PlanVersionMeta(
        id=vid,
        created_at=ts,
        label=label,
        metric_id="five_percent",
        direction="higher_is_better",
        solver="cumulative_slope",
        network_target=result.network.network_target,
        as_of=result.as_of,
        planning_year=result.planning_year,
        cumulative_start=cumulative_start,
        network_mean_at_save=result.network.network_mean_as_of,
        params=params,
    )
    return PlanVersion(
        meta=meta,
        stores=stores,
        network_monthly_target=net_m,
        network_cumulative_planned=net_c,
    )


def plan_version_to_dict(version: PlanVersion) -> dict[str, Any]:
    return {
        "meta": {
            "id": version.meta.id,
            "created_at": version.meta.created_at,
            "label": version.meta.label,
            "metric_id": version.meta.metric_id,
            "direction": version.meta.direction,
            "solver": version.meta.solver,
            "network_target": version.meta.network_target,
            "as_of": _ym_dict(version.meta.as_of),
            "planning_year": version.meta.planning_year,
            "cumulative_start": _ym_dict(version.meta.cumulative_start),
            "network_mean_at_save": version.meta.network_mean_at_save,
            "params": asdict(version.meta.params),
        },
        "stores": [
            {
                "store_id": s.store_id,
                "monthly_target": [_ms_dict(m) for m in s.monthly_target],
                "implied_target": s.implied_target,
                "cumulative_planned": [_ms_dict(m) for m in s.cumulative_planned],
            }
            for s in version.stores
        ],
        "network_monthly_target": [_ms_dict(m) for m in version.network_monthly_target],
        "network_cumulative_planned": [_ms_dict(m) for m in version.network_cumulative_planned],
    }


def plan_version_from_dict(data: dict[str, Any]) -> PlanVersion:
    meta_d = data["meta"]
    meta = PlanVersionMeta(
        id=str(meta_d["id"]),
        created_at=str(meta_d["created_at"]),
        label=meta_d.get("label"),
        metric_id=str(meta_d.get("metric_id", "five_percent")),
        direction=str(meta_d.get("direction", "higher_is_better")),
        solver=str(meta_d.get("solver", "cumulative_slope")),
        network_target=float(meta_d["network_target"]),
        as_of=_ym_from(meta_d["as_of"]),
        planning_year=int(meta_d["planning_year"]),
        cumulative_start=_ym_from(meta_d["cumulative_start"]),
        network_mean_at_save=float(meta_d["network_mean_at_save"]),
        params=_params_from(meta_d.get("params") or {}),
    )
    stores = tuple(
        PlanVersionStoreRow(
            store_id=int(s["store_id"]),
            monthly_target=tuple(_ms_from(m) for m in s["monthly_target"]),
            implied_target=float(s["implied_target"]),
            cumulative_planned=tuple(_ms_from(m) for m in s["cumulative_planned"]),
        )
        for s in data["stores"]
    )
    return PlanVersion(
        meta=meta,
        stores=stores,
        network_monthly_target=tuple(_ms_from(m) for m in data["network_monthly_target"]),
        network_cumulative_planned=tuple(
            _ms_from(m) for m in data["network_cumulative_planned"]
        ),
    )


def overlay_frozen_baseline(
    result: SimulationResult,
    version: PlanVersion,
) -> SimulationResult:
    """Replace live monthly_target / cumulative_planned with frozen version curves."""
    by_id = {s.store_id: s for s in version.stores}
    stores = []
    for s in result.stores:
        frozen = by_id.get(s.store_id)
        if frozen is None:
            stores.append(s)
            continue
        stores.append(
            StoreCurves(
                store_id=s.store_id,
                monthly_target=frozen.monthly_target,
                cumulative_planned=frozen.cumulative_planned,
                actual=s.actual,
                cumulative_actual=s.cumulative_actual,
                simulation=s.simulation,
                cumulative_actual_or_simulation=s.cumulative_actual_or_simulation,
                implied_target=frozen.implied_target,
                gap_to_mean=s.gap_to_mean,
                slope=s.slope,
                unreachable=s.unreachable,
                suggested_implied_target=s.suggested_implied_target,
                capped=s.capped,
            )
        )
    return SimulationResult(
        as_of=result.as_of,
        planning_year=result.planning_year,
        network=result.network,
        stores=tuple(stores),
        unreachable=result.unreachable,
    )
