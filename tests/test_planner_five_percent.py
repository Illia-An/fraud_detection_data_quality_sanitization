"""Unit tests for simplified five_percent planner."""

from __future__ import annotations

import pytest

from planner.five_percent import (
    add_calendar_months,
    plan_five_percent,
    trajectory_weights,
)


def test_trajectory_uniform_sums_to_one():
    w = trajectory_weights(6, "uniform")
    assert len(w) == 6
    assert abs(sum(w) - 1.0) < 1e-9


def test_add_calendar_months_wraps_year():
    assert add_calendar_months(2025, 11, 2) == (2026, 1)


def test_plan_moves_chain_toward_target():
    result = plan_five_percent(
        baseline={10: 68.0, 20: 72.0},
        target=75.0,
        n_months=6,
        max_monthly_improve=4.0,
        priority_power=1.0,
        trajectory="uniform",
        reference_year=2025,
        reference_month=3,
    )
    assert result.current_chain == pytest.approx(70.0)
    assert result.required_change == pytest.approx(5.0)
    assert result.final_chain >= result.current_chain
    assert len(result.chain_trajectory) == 6
    assert len(result.projections) == 2
    assert result.projections[0].months[0].year == 2025
    assert result.projections[0].months[0].month == 4


def test_plan_already_at_target_zero_change():
    result = plan_five_percent(
        baseline={1: 80.0, 2: 80.0},
        target=75.0,
        n_months=3,
        reference_year=2025,
        reference_month=1,
    )
    assert result.required_change == 0.0
    assert result.feasible
