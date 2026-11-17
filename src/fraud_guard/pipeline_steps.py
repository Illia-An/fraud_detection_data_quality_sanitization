"""Pipeline step naming aliases (Wave 8 / M-09).

Physical modules (after the tier-rename track):

- ``pipeline_row_rules`` — pipeline steps **tier1–tier3** (blacklist, freq,
  always-top-box); historical file ``tier1.py``
- ``pipeline_store_month`` — pipeline step **tier4**; historical ``tier2.py``
- ``research_isolation_forest`` — research IsolationForest (lazy; not used by
  the API pipeline); historical ``tier3.py``

Prefer these aliases in new code so step names match ``PipelineConfig`` /
``SanitizationResponse.steps``.
"""

from __future__ import annotations

from fraud_guard.pipeline_row_rules import (
    apply_always_topbox_tier as apply_pipeline_tier3,
    apply_blacklist_tier as apply_pipeline_tier1,
    apply_freq_tier as apply_pipeline_tier2,
    keep_clean_rows as keep_pipeline_tier123_clean,
)
from fraud_guard.pipeline_store_month import (
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
