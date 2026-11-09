"""Mean-distance boost / slope (SPEC-P001 D-03, D-04, D-10)."""

from __future__ import annotations


def gap_to_mean(network_mean: float, store_score: float) -> float:
    """Positive when store is below the network mean."""
    return network_mean - store_score


def monthly_slope(
    *,
    store_score: float,
    network_mean: float,
    history_cap: float,
    mild_rate: float,
    boost_gain: float,
    plateau: bool,
) -> float:
    """Non-negative monthly score step for Survey higher-is-better.

    Below mean → steeper (capped by history). Above mean → mild rate.
    Plateau → 0 (hold). Never negative (no clawback).
    """
    if plateau:
        return 0.0
    if history_cap < 0 or mild_rate < 0 or boost_gain < 0:
        raise ValueError("history_cap, mild_rate, boost_gain must be >= 0")

    gap = gap_to_mean(network_mean, store_score)
    if gap > 0:
        # Farther below mean → larger boost.
        raw = mild_rate + boost_gain * gap
    else:
        # At/above mean → mild upward trend only.
        raw = mild_rate
    return min(history_cap, max(0.0, raw))


def is_ahead_of_schedule(
    *,
    cumulative_as_of: float,
    months_elapsed: int,
    months_total: int,
    network_target: float,
    start_cum: float,
    plateau_ahead_pp: float,
) -> bool:
    """True when cumulative is substantially above the linear path to network_target."""
    if months_elapsed < 1 or months_total < 1:
        return False
    if months_elapsed >= months_total:
        return cumulative_as_of + 1e-9 >= network_target
    # Linear required cumulative at this step.
    required = start_cum + (network_target - start_cum) * (months_elapsed / months_total)
    return cumulative_as_of + 1e-9 >= required + plateau_ahead_pp
