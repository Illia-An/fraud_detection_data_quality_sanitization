"""Deprecated alias for ``fraud_guard.pipeline_store_month``.

Historical name: this file held pipeline step 4 (store×month). Prefer
``pipeline_store_month`` in new code. Symbols and behaviour are unchanged.
"""

from __future__ import annotations

import warnings

warnings.warn(
    "fraud_guard.tier2 is deprecated; use fraud_guard.pipeline_store_month",
    DeprecationWarning,
    stacklevel=2,
)

from fraud_guard.pipeline_store_month import (
    FLAG_COL,
    REASON_COL,
    REASON_HIGH_STORE_MONTH,
    Tier2Config,
    apply_tier2,
    build_store_month_panel,
    high_store_months,
    keep_clean_rows,
)

__all__ = [
    "FLAG_COL",
    "REASON_COL",
    "REASON_HIGH_STORE_MONTH",
    "Tier2Config",
    "apply_tier2",
    "build_store_month_panel",
    "high_store_months",
    "keep_clean_rows",
]
