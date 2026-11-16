"""Pipeline step naming aliases (Wave 8 / M-09).

Historical file layout (kept for compatibility):

- ``tier1.py`` — pipeline steps **tier1–tier3** (blacklist, freq, always-top-box)
- ``tier2.py`` — pipeline step **tier4** (store×month z / pct)
- ``tier3.py`` — research IsolationForest (lazy; not used by the API pipeline)

Prefer these aliases in new code so step names match ``PipelineConfig`` /
``SanitizationResponse.steps``.
"""

from __future__ import annotations

from fraud_guard.tier1 import (
    apply_always_topbox_tier as apply_pipeline_tier3,
    apply_blacklist_tier as apply_pipeline_tier1,
    apply_freq_tier as apply_pipeline_tier2,
    keep_clean_rows as keep_pipeline_tier123_clean,
)
from fraud_guard.tier2 import (
    apply_tier2 as apply_pipeline_tier4,
    keep_clean_rows as keep_pipeline_tier4_clean,
)

__all__ = [
    "apply_pipeline_tier1",
    "apply_pipeline_tier2",
    "apply_pipeline_tier3",
    "apply_pipeline_tier4",
    "keep_pipeline_tier123_clean",
    "keep_pipeline_tier4_clean",
]
