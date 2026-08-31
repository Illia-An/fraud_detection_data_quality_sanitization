"""Fraud detection / sanitization guard layer (pure logic, no UI coupling)."""

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
from fraud_guard.tier3 import Tier3Config, apply_tier3
from fraud_guard.tier3 import keep_clean_rows as keep_clean_rows_tier3

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
