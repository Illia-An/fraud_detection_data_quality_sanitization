"""Unit tests for the lower-is-better TTS planner."""

from __future__ import annotations

import pytest

from planner.tts import plan_tts


def test_plan_reduces_chain_toward_target():
    result = plan_tts(
        baseline={10: 4.2, 20: 3.8},
        target=3.5,
        n_months=6,
        max_monthly_improve=0.25,
        priority_power=1.0,
        trajectory="uniform",
        reference_year=2025,
        reference_month=3,
    )
    assert result.metric_id == "tts"
    assert result.unit == "min"
    assert result.direction == "lower_is_better"
    assert result.current_chain == pytest.approx(4.0)
    assert result.required_change == pytest.approx(0.5)
    assert result.final_chain <= result.current_chain
    assert result.final_chain == pytest.approx(3.5)
    assert result.feasible
    assert len(result.chain_trajectory) == 6
    assert len(result.projections) == 2
    assert result.projections[0].months[0].year == 2025
    assert result.projections[0].months[0].month == 4

    by_store = {proj.store_id: proj for proj in result.projections}
    slow = by_store[10].months
    fast = by_store[20].months
    assert slow[-1].score == pytest.approx(3.5)
    assert fast[-1].score == pytest.approx(3.5)
    assert slow[-1].score - 4.2 < fast[-1].score - 3.8

    previous = {10: 4.2, 20: 3.8}
    for month_score in result.chain_trajectory:
        assert month_score.score <= result.current_chain + 1e-9
    for proj in result.projections:
        prior = previous[proj.store_id]
        for point in proj.months:
            assert point.score <= prior + 1e-9
            assert point.score >= 0.0
            prior = point.score


def test_plan_rejects_target_above_current_chain():
    with pytest.raises(ValueError, match="must improve"):
        plan_tts(
            baseline={10: 4.2, 20: 3.8},
            target=4.5,
            n_months=6,
            reference_year=2025,
            reference_month=3,
        )


def test_plan_hold_when_target_equals_chain():
    result = plan_tts(
        baseline={1: 3.5, 2: 3.5},
        target=3.5,
        n_months=3,
        reference_year=2025,
        reference_month=1,
    )
    assert result.required_change == 0.0
    assert result.final_chain == pytest.approx(3.5)
    assert result.feasible


def test_plan_does_not_cross_floor():
    result = plan_tts(
        baseline={10: 0.05},
        target=0.0,
        n_months=2,
        max_monthly_improve=1.0,
        reference_year=2026,
        reference_month=1,
    )
    assert result.projections[0].months[-1].score == pytest.approx(0.0)
    assert all(point.score >= 0.0 for point in result.projections[0].months)


def test_plan_infeasible_when_monthly_cap_is_tight():
    result = plan_tts(
        baseline={10: 4.0, 20: 4.0},
        target=3.0,
        n_months=2,
        max_monthly_improve=0.05,
        reference_year=2025,
        reference_month=6,
    )
    assert result.final_chain > result.target
    assert result.feasible is False
    assert result.final_chain < result.current_chain
