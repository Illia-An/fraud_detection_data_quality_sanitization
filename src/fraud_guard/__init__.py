"""Fraud detection / sanitization guard layer (pure logic, no UI coupling)."""

from __future__ import annotations

from typing import Any

from fraud_guard.contracts import FilterStats, MonthlyMetricRow, SanitizedBundle
from fraud_guard.tier1 import (
    RATE_GET_ANSWERS_MAPPING,
    Tier1Config,
    apply_tier1,
    filter_answered_metric_rows,
    keep_clean_rows,
)
from fraud_guard.tier2 import Tier2Config, apply_tier2
from fraud_guard.tier2 import keep_clean_rows as keep_clean_rows_tier2

# tier3 / sklearn stay out of the default import path (Wave 7 / A-10, M-11).
_TIER3_EXPORTS = frozenset({"Tier3Config", "apply_tier3", "keep_clean_rows_tier3"})

__all__ = [
    "FilterStats",
    "MonthlyMetricRow",
    "SanitizedBundle",
    "RATE_GET_ANSWERS_MAPPING",
    "Tier1Config",
    "Tier2Config",
    "Tier3Config",
    "apply_tier1",
    "apply_tier2",
    "apply_tier3",
    "filter_answered_metric_rows",
    "keep_clean_rows",
    "keep_clean_rows_tier2",
    "keep_clean_rows_tier3",
]


def __getattr__(name: str) -> Any:
    if name not in _TIER3_EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from fraud_guard import tier3 as _tier3

    mapping = {
        "Tier3Config": _tier3.Tier3Config,
        "apply_tier3": _tier3.apply_tier3,
        "keep_clean_rows_tier3": _tier3.keep_clean_rows,
    }
    value = mapping[name]
    globals()[name] = value
    return value
