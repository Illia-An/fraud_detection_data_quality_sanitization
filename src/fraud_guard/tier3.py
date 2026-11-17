"""Deprecated alias for ``fraud_guard.research_isolation_forest``.

Historical name collided with pipeline step ``tier3`` (always top-box). This
module is the research IsolationForest path (not used by the API pipeline).
Prefer ``research_isolation_forest`` in new code.
"""

from __future__ import annotations

import warnings

warnings.warn(
    "fraud_guard.tier3 is deprecated; use fraud_guard.research_isolation_forest",
    DeprecationWarning,
    stacklevel=2,
)

from fraud_guard.research_isolation_forest import (
    FEATURE_COLS,
    FLAG_COL,
    REASON_COL,
    REASON_IF_ANOMALY,
    Tier3Config,
    anomaly_entities,
    apply_tier3,
    build_entity_feature_table,
    keep_clean_rows,
)

__all__ = [
    "FEATURE_COLS",
    "FLAG_COL",
    "REASON_COL",
    "REASON_IF_ANOMALY",
    "Tier3Config",
    "anomaly_entities",
    "apply_tier3",
    "build_entity_feature_table",
    "keep_clean_rows",
]
