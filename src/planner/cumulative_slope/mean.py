"""Equal-weight network mean (SPEC-P001 D-10)."""

from __future__ import annotations


def equal_weight_mean(values: list[float]) -> float:
    if not values:
        raise ValueError("values must contain at least one score")
    return sum(values) / len(values)
