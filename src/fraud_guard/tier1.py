"""Deprecated alias for ``fraud_guard.pipeline_row_rules``.

Historical name: this file held pipeline steps 1–3. Prefer importing from
``pipeline_row_rules`` in new code. Symbols and behaviour are unchanged.
"""

from __future__ import annotations

import warnings

warnings.warn(
    "fraud_guard.tier1 is deprecated; use fraud_guard.pipeline_row_rules",
    DeprecationWarning,
    stacklevel=2,
)

from fraud_guard.pipeline_row_rules import (
    CUSTOMER_BLACKLIST_VALUE,
    ENTITY_COL,
    FLAG_COL,
    RATE_GET_ANSWERS_MAPPING,
    REASON_ALWAYS_TOPBOX,
    REASON_BLACKLIST,
    REASON_COL,
    REASON_FREQ_STORE_DAY,
    SATISFACTION_QUESTION_ID,
    TOP_BOX_VALUE,
    Tier1Config,
    apply_always_topbox_tier,
    apply_blacklist_tier,
    apply_freq_tier,
    apply_tier1,
    build_entity_key,
    filter_answered_metric_rows,
    keep_clean_rows,
    top_box_rate,
)

__all__ = [
    "CUSTOMER_BLACKLIST_VALUE",
    "ENTITY_COL",
    "FLAG_COL",
    "RATE_GET_ANSWERS_MAPPING",
    "REASON_ALWAYS_TOPBOX",
    "REASON_BLACKLIST",
    "REASON_COL",
    "REASON_FREQ_STORE_DAY",
    "SATISFACTION_QUESTION_ID",
    "TOP_BOX_VALUE",
    "Tier1Config",
    "apply_always_topbox_tier",
    "apply_blacklist_tier",
    "apply_freq_tier",
    "apply_tier1",
    "build_entity_key",
    "filter_answered_metric_rows",
    "keep_clean_rows",
    "top_box_rate",
]
