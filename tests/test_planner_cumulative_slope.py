"""Phase 1 tests for cumulative-slope planner (SPEC-P001)."""

from __future__ import annotations

import pytest

from planner.cumulative_slope import (
    NetworkPlanParams,
    StoreMonthFact,
    YearMonth,
    equal_weight_mean,
    simulate,
)
from planner.cumulative_slope.boost import gap_to_mean, monthly_slope
from planner.cumulative_slope.cumulative import cumulative_mean, stitch_cumulative_actual_or_sim
from planner.cumulative_slope.history import history_cap


def _fact(store_id: int, year: int, month: int, score: float) -> StoreMonthFact:
    return StoreMonthFact(
        store_id=store_id, year=year, month=month, five_percent=score
    )


def _series(store_id: int, start: YearMonth, scores: list[float]) -> list[StoreMonthFact]:
    out: list[StoreMonthFact] = []
    y, m = start.year, start.month
    for score in scores:
        out.append(_fact(store_id, y, m, score))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def test_equal_weight_mean():
    assert equal_weight_mean([70.0, 80.0]) == pytest.approx(75.0)


def test_cumulative_mean_running():
    assert cumulative_mean([60.0, 80.0, 70.0]) == pytest.approx(
        [60.0, 70.0, 70.0]
    )


def test_history_cap_max_mom():
    # MoM: +2, +5, -1 → max positive 5
    assert history_cap([60.0, 62.0, 67.0, 66.0], mode="max_mom", min_cap=0.25) == pytest.approx(
        5.0
    )


def test_history_cap_floor_when_flat():
    assert history_cap([70.0, 70.0, 70.0], mode="max_mom", min_cap=0.25) == pytest.approx(0.25)


def test_boost_weak_steeper_than_strong():
    weak = monthly_slope(
        store_score=60.0,
        network_mean=70.0,
        history_cap=4.0,
        mild_rate=0.5,
        boost_gain=0.15,
        plateau=False,
    )
    strong = monthly_slope(
        store_score=80.0,
        network_mean=70.0,
        history_cap=4.0,
        mild_rate=0.5,
        boost_gain=0.15,
        plateau=False,
    )
    assert weak > strong
    assert strong == pytest.approx(0.5)
    assert gap_to_mean(70.0, 60.0) == pytest.approx(10.0)


def test_boost_plateau_zero_and_never_negative():
    assert (
        monthly_slope(
            store_score=90.0,
            network_mean=70.0,
            history_cap=4.0,
            mild_rate=0.5,
            boost_gain=0.15,
            plateau=True,
        )
        == 0.0
    )


def test_stitch_cumulative_handoff_continuous():
    actual_m = [YearMonth(2025, 1), YearMonth(2025, 2)]
    actual_s = [60.0, 70.0]
    sim_m = [YearMonth(2025, 3)]
    sim_s = [80.0]
    stitched = stitch_cumulative_actual_or_sim(actual_m, actual_s, sim_m, sim_s)
    assert len(stitched) == 3
    assert stitched[1].score == pytest.approx(65.0)
    # mean(60,70,80)=70
    assert stitched[2].score == pytest.approx(70.0)


def test_simulate_non_decreasing_and_weak_boost():
    # Two stores Jan–Mar 2025; as_of Mar; plan rest of 2025.
    weak = _series(10, YearMonth(2025, 1), [60.0, 61.0, 62.0])  # max mom 1
    strong = _series(20, YearMonth(2025, 1), [78.0, 79.0, 80.0])  # max mom 1
    result = simulate(
        facts=weak + strong,
        network_target=75.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        cumulative_start=YearMonth(2025, 1),
        params=NetworkPlanParams(
            mild_rate=0.5,
            boost_gain=0.2,
            min_history_cap=0.25,
            plateau_ahead_pp=50.0,  # disable plateau via huge threshold
        ),
    )
    assert result.network.network_mean_as_of == pytest.approx(71.0)
    by = {s.store_id: s for s in result.stores}
    assert by[10].gap_to_mean > 0
    assert by[20].gap_to_mean < 0
    assert by[10].slope > by[20].slope

    for store in result.stores:
        scores = [m.score for m in store.simulation]
        for a, b in zip(scores, scores[1:]):
            assert b + 1e-9 >= a
        # Actual→sim stitch: last actual cum == stitched at as-of index
        assert store.cumulative_actual[-1].score == pytest.approx(
            store.cumulative_actual_or_simulation[len(store.actual) - 1].score
        )


def test_simulate_plateau_when_ahead():
    # Strong store already far above linear path → plateau (slope 0).
    facts = _series(1, YearMonth(2025, 1), [90.0, 91.0, 92.0])
    result = simulate(
        facts=facts,
        network_target=75.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        cumulative_start=YearMonth(2025, 1),
        params=NetworkPlanParams(plateau_ahead_pp=0.0),
    )
    store = result.stores[0]
    assert store.slope == pytest.approx(0.0)
    assert all(m.score == pytest.approx(92.0) for m in store.simulation)


def test_unreachable_suggests_lower_implied_target():
    # Flat history → min_cap 0.25; cannot reach 95 from 70 in few months if we set tiny cap.
    facts = _series(5, YearMonth(2025, 1), [70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0])
    result = simulate(
        facts=facts,
        network_target=95.0,
        as_of=YearMonth(2025, 10),
        planning_year=2025,
        cumulative_start=YearMonth(2025, 1),
        params=NetworkPlanParams(min_history_cap=0.25, mild_rate=0.5, boost_gain=0.5),
    )
    store = result.stores[0]
    assert store.unreachable
    assert store.suggested_implied_target is not None
    assert store.suggested_implied_target < store.implied_target
    assert len(result.unreachable) == 1
    assert result.unreachable[0].store_id == 5
    # Capped path never exceeds 100 and is non-decreasing.
    assert all(m.score <= 100.0 for m in store.simulation)
    scores = [m.score for m in store.simulation]
    for a, b in zip(scores, scores[1:]):
        assert b + 1e-9 >= a


def test_no_clawback_for_store_above_mean():
    facts = (
        _series(1, YearMonth(2025, 1), [60.0, 61.0, 62.0])
        + _series(2, YearMonth(2025, 1), [85.0, 86.0, 87.0])
    )
    result = simulate(
        facts=facts,
        network_target=75.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        params=NetworkPlanParams(plateau_ahead_pp=100.0),
    )
    strong = next(s for s in result.stores if s.store_id == 2)
    assert strong.slope >= 0.0
    assert all(
        b + 1e-9 >= a
        for a, b in zip(
            [m.score for m in strong.simulation],
            [m.score for m in strong.simulation][1:],
        )
    )


def test_implied_target_override_adjust_path():
    facts = _series(9, YearMonth(2025, 1), [70.0, 70.5, 71.0])
    base = simulate(
        facts=facts,
        network_target=90.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        params=NetworkPlanParams(min_history_cap=0.5),
    )
    adjusted = simulate(
        facts=facts,
        network_target=90.0,
        as_of=YearMonth(2025, 3),
        planning_year=2025,
        params=NetworkPlanParams(min_history_cap=0.5),
        implied_target_overrides={9: 72.0},
    )
    assert adjusted.stores[0].implied_target == pytest.approx(72.0)
    # Lower implied target should not make store more unreachable than aiming at 90.
    assert adjusted.stores[0].unreachable is False or (
        base.stores[0].unreachable and adjusted.stores[0].suggested_implied_target is not None
    )
