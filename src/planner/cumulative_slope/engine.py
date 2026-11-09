"""Cumulative-slope simulation engine (SPEC-P001 Phase 1).

Behaviour locks (tests enforce):
- equal-weight network mean
- boost from distance below mean; mild/plateau above; never clawback
- cumulative actual from cumulative_start; continuous fact→sim handoff
- history/100% cap + unreachable suggestion
"""

from __future__ import annotations

from planner.cumulative_slope.boost import (
    gap_to_mean,
    is_ahead_of_schedule,
    monthly_slope,
)
from planner.cumulative_slope.calendar_util import add_months, compare_ym, month_span
from planner.cumulative_slope.cumulative import (
    cumulative_mean,
    stitch_cumulative_actual_or_sim,
    zip_month_scores,
)
from planner.cumulative_slope.history import history_cap
from planner.cumulative_slope.mean import equal_weight_mean
from planner.cumulative_slope.types import (
    NetworkPlanParams,
    NetworkSummary,
    SimulationResult,
    StoreCurves,
    StoreMonthFact,
    UnreachableHint,
    YearMonth,
)


def _round(x: float) -> float:
    return round(x, 4)


def _facts_by_store(
    facts: list[StoreMonthFact],
    *,
    cumulative_start: YearMonth,
    as_of: YearMonth,
) -> dict[int, list[StoreMonthFact]]:
    by: dict[int, list[StoreMonthFact]] = {}
    for fact in facts:
        ym = YearMonth(fact.year, fact.month)
        if compare_ym(ym, cumulative_start) < 0:
            continue
        if compare_ym(ym, as_of) > 0:
            continue
        by.setdefault(fact.store_id, []).append(fact)
    for sid in by:
        by[sid].sort(key=lambda f: (f.year, f.month))
    return by


def _score_map(rows: list[StoreMonthFact]) -> dict[tuple[int, int], float]:
    return {(r.year, r.month): float(r.five_percent) for r in rows}


def _as_of_score(rows: list[StoreMonthFact], as_of: YearMonth) -> float:
    """Prefer exact as-of month; else last available month <= as_of."""
    if not rows:
        raise ValueError("store has no facts in cumulative window")
    exact = next((r for r in reversed(rows) if r.year == as_of.year and r.month == as_of.month), None)
    if exact is not None:
        return float(exact.five_percent)
    return float(rows[-1].five_percent)


def _build_actual_series(
    rows: list[StoreMonthFact],
    months: list[YearMonth],
) -> tuple[list[YearMonth], list[float]]:
    """Contiguous actual months that have scores; stops at first gap after start."""
    scores_map = _score_map(rows)
    out_m: list[YearMonth] = []
    out_s: list[float] = []
    started = False
    for ym in months:
        key = (ym.year, ym.month)
        if key in scores_map:
            started = True
            out_m.append(ym)
            out_s.append(scores_map[key])
        elif started:
            # Gap inside the window — keep only prefix (strict continuity).
            break
    if not out_s:
        # Fall back to available rows order even if not aligned to spine.
        out_m = [YearMonth(r.year, r.month) for r in rows]
        out_s = [float(r.five_percent) for r in rows]
    return out_m, out_s


def simulate(
    *,
    facts: list[StoreMonthFact],
    network_target: float,
    as_of: YearMonth,
    planning_year: int,
    cumulative_start: YearMonth | None = None,
    params: NetworkPlanParams | None = None,
    implied_target_overrides: dict[int, float] | None = None,
) -> SimulationResult:
    """Live simulation from cumulative actuals through Dec(planning_year)."""
    if not facts:
        raise ValueError("facts must contain at least one row")
    if not (0.0 <= network_target <= 100.0):
        raise ValueError("network_target must be within [0, 100]")

    cfg = params or NetworkPlanParams()
    start = cumulative_start or YearMonth(2025, 1)
    if compare_ym(as_of, start) < 0:
        raise ValueError("as_of must be on or after cumulative_start")
    year_end = YearMonth(planning_year, 12)
    if compare_ym(as_of, year_end) > 0:
        raise ValueError("as_of cannot be after planning_year December")

    overrides = implied_target_overrides or {}
    by_store = _facts_by_store(facts, cumulative_start=start, as_of=as_of)
    if not by_store:
        raise ValueError("no facts in [cumulative_start, as_of]")

    store_ids = sorted(by_store.keys())
    spine_to_as_of = month_span(start, as_of)
    future = month_span(add_months(as_of, 1), year_end) if compare_ym(as_of, year_end) < 0 else []
    months_total = len(month_span(start, year_end))

    as_of_scores = {sid: _as_of_score(by_store[sid], as_of) for sid in store_ids}
    network_mean = equal_weight_mean([as_of_scores[sid] for sid in store_ids])

    # First pass: slopes, caps, unreachable without network-impact yet.
    draft: list[dict] = []
    for sid in store_ids:
        rows = by_store[sid]
        actual_months, actual_scores = _build_actual_series(rows, spine_to_as_of)
        score = as_of_scores[sid]
        cap = history_cap(
            actual_scores,
            mode=cfg.history_cap_mode,
            min_cap=cfg.min_history_cap,
        )
        cum_series = cumulative_mean(actual_scores)
        cum_as_of = cum_series[-1]
        start_cum = cum_series[0]
        months_elapsed = len(actual_scores)
        plateau = is_ahead_of_schedule(
            cumulative_as_of=cum_as_of,
            months_elapsed=months_elapsed,
            months_total=months_total,
            network_target=network_target,
            start_cum=start_cum,
            plateau_ahead_pp=cfg.plateau_ahead_pp,
        )
        # At metric ceiling → hold.
        if score >= cfg.ceiling - 1e-9:
            plateau = True

        slope = monthly_slope(
            store_score=score,
            network_mean=network_mean,
            history_cap=cap,
            mild_rate=cfg.mild_rate,
            boost_gain=cfg.boost_gain,
            plateau=plateau,
        )
        implied = float(overrides.get(sid, network_target))
        implied = min(cfg.ceiling, max(cfg.floor, implied))

        months_left = len(future)
        max_achievable = score + months_left * cap
        max_achievable = min(cfg.ceiling, max_achievable)
        # Period >100%: cannot require a monthly level above ceiling.
        needs_above_ceiling = implied > cfg.ceiling + 1e-9
        needs_above_history = implied > max_achievable + 1e-9
        unreachable = needs_above_ceiling or needs_above_history
        reason = (
            "above_period_100pct"
            if needs_above_ceiling
            else ("above_history_cap" if needs_above_history else "above_history_cap")
        )
        suggested = None
        if unreachable:
            # Max realistic EOY under cap, floored to 1pp below implied when possible.
            suggested = _round(min(implied - 1.0, max_achievable))
            suggested = min(cfg.ceiling, max(cfg.floor, suggested))
            if suggested >= implied - 1e-9:
                suggested = _round(max_achievable)

        # Project future monthlies with constant slope (recompute mild/boost only once).
        sim_scores: list[float] = []
        cur = score
        capped = unreachable
        for _ in future:
            step = slope
            room = max(0.0, cfg.ceiling - cur)
            take = min(step, room, cap)
            if take + 1e-12 < step:
                capped = True
            cur = min(cfg.ceiling, max(cfg.floor, cur + take))
            # Monotone non-decrease guaranteed by take >= 0.
            sim_scores.append(cur)

        # Monthly targets for planning_year: actuals for elapsed months in year, sim after.
        plan_year_months = month_span(YearMonth(planning_year, 1), YearMonth(planning_year, 12))
        scores_by_ym = {(m.year, m.month): s for m, s in zip(actual_months, actual_scores, strict=True)}
        for m, s in zip(future, sim_scores, strict=True):
            scores_by_ym[(m.year, m.month)] = s
        monthly_target_scores: list[float] = []
        for m in plan_year_months:
            if (m.year, m.month) in scores_by_ym:
                monthly_target_scores.append(scores_by_ym[(m.year, m.month)])
            elif compare_ym(m, as_of) <= 0:
                # Missing past month in planning year: carry last known.
                monthly_target_scores.append(score if not actual_scores else actual_scores[-1])
            else:
                monthly_target_scores.append(sim_scores[-1] if sim_scores else score)

        draft.append(
            {
                "sid": sid,
                "actual_months": actual_months,
                "actual_scores": actual_scores,
                "sim_scores": sim_scores,
                "slope": slope,
                "gap": gap_to_mean(network_mean, score),
                "implied": implied,
                "unreachable": unreachable,
                "reason": reason,
                "suggested": suggested,
                "capped": capped,
                "plan_year_months": plan_year_months,
                "monthly_target_scores": monthly_target_scores,
                "eoy": sim_scores[-1] if sim_scores else score,
            }
        )

    projected_mean = equal_weight_mean([d["eoy"] for d in draft])
    feasible = projected_mean + 1e-8 >= network_target

    # Network impact of suggestions: replace unreachable EOY with suggested path endpoint.
    hints: list[UnreachableHint] = []
    for d in draft:
        if not d["unreachable"] or d["suggested"] is None:
            continue
        alt_eoy = float(d["suggested"])
        alt_values = []
        for other in draft:
            if other["sid"] == d["sid"]:
                alt_values.append(alt_eoy)
            else:
                alt_values.append(other["eoy"])
        alt_mean = equal_weight_mean(alt_values)
        hints.append(
            UnreachableHint(
                store_id=d["sid"],
                implied_target=_round(d["implied"]),
                suggested_implied_target=_round(d["suggested"]),
                reason=d["reason"],
                network_impact_pp=_round(alt_mean - projected_mean),
            )
        )

    stores: list[StoreCurves] = []
    for d in draft:
        actual_ms = zip_month_scores(d["actual_months"], d["actual_scores"])
        cum_actual = zip_month_scores(
            d["actual_months"], cumulative_mean(d["actual_scores"])
        )
        sim_ms = zip_month_scores(future, d["sim_scores"]) if future else tuple()
        stitched = stitch_cumulative_actual_or_sim(
            d["actual_months"],
            d["actual_scores"],
            future,
            d["sim_scores"],
        )
        monthly_target = zip_month_scores(d["plan_year_months"], d["monthly_target_scores"])
        cum_planned = zip_month_scores(
            d["plan_year_months"], cumulative_mean(d["monthly_target_scores"])
        )
        stores.append(
            StoreCurves(
                store_id=d["sid"],
                monthly_target=monthly_target,
                cumulative_planned=cum_planned,
                actual=actual_ms,
                cumulative_actual=cum_actual,
                simulation=sim_ms,
                cumulative_actual_or_simulation=stitched,
                implied_target=_round(d["implied"]),
                gap_to_mean=_round(d["gap"]),
                slope=_round(d["slope"]),
                unreachable=bool(d["unreachable"]),
                suggested_implied_target=(
                    _round(d["suggested"]) if d["suggested"] is not None else None
                ),
                capped=bool(d["capped"]),
            )
        )

    return SimulationResult(
        as_of=as_of,
        planning_year=planning_year,
        network=NetworkSummary(
            network_target=_round(network_target),
            network_mean_as_of=_round(network_mean),
            projected_network_mean_eoy=_round(projected_mean),
            feasible=feasible,
            store_count=len(store_ids),
        ),
        stores=tuple(stores),
        unreachable=tuple(hints),
    )


def build_baseline_plan(
    *,
    facts: list[StoreMonthFact],
    network_target: float,
    as_of: YearMonth,
    planning_year: int,
    cumulative_start: YearMonth | None = None,
    params: NetworkPlanParams | None = None,
) -> SimulationResult:
    """Compute curves suitable for freezing as a PlanVersion (Save).

    Same engine as live simulation; caller persists monthly_target / meta.
    """
    return simulate(
        facts=facts,
        network_target=network_target,
        as_of=as_of,
        planning_year=planning_year,
        cumulative_start=cumulative_start,
        params=params,
    )
