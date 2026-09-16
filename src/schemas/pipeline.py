"""Shared sanitization pipeline contracts — SPEC.md Section 2."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

PipelineStepName = Literal["actual", "tier1", "tier2", "tier3", "tier4"]

_LEGACY_CONFIG_KEY_MAP: tuple[tuple[str, str], ...] = (
    ("tier1_freq_enabled", "tier2_freq_enabled"),
    ("tier1_freq_threshold", "tier2_freq_threshold"),
    ("tier1_always_five_enabled", "tier3_always_five_enabled"),
    ("tier1_always_five_min_n", "tier3_always_five_min_n"),
    ("tier2_min_volume", "tier4_min_volume"),
    ("tier2_z_threshold", "tier4_z_threshold"),
    ("tier2_pct_threshold", "tier4_pct_threshold"),
)


def migrate_legacy_pipeline_config(data: Any) -> Any:
    """Map pre-split-tier config keys to the four-tier PipelineConfig shape."""
    if not isinstance(data, dict):
        return data
    out = dict(data)
    for old_key, new_key in _LEGACY_CONFIG_KEY_MAP:
        if old_key in out and new_key not in out:
            out[new_key] = out[old_key]
    return out


class PipelineConfig(BaseModel):
    """Effective sanitization thresholds (SPEC Section 2).

    Pipeline steps:
    - tier1: BlackList filter (keep Hebrew ``לא``)
    - tier2: Frequency filter (entity×store×day)
    - tier3: Always top-box (optional)
    - tier4: Store×month anomaly (min volume, z high, five % min)
    """

    model_config = ConfigDict(extra="ignore")

    tier1_blacklist_enabled: bool = True
    tier2_freq_enabled: bool = True
    tier2_freq_threshold: int = Field(default=3, ge=2)
    tier3_always_five_enabled: bool = False
    tier3_always_five_min_n: int = Field(default=10, ge=1)
    tier4_enabled: bool = True
    tier4_min_volume: int = Field(default=30, ge=1)
    tier4_z_threshold: float = Field(default=2.0, ge=0.0)
    tier4_pct_threshold: float = Field(default=90.0, ge=0.0, le=100.0)

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy_keys(cls, data: Any) -> Any:
        return migrate_legacy_pipeline_config(data)


class StepMetric(BaseModel):
    step_name: PipelineStepName
    rows_in: int
    rows_out: int
    rows_dropped: int
    top_box_pct: float


class SanitizationResponse(BaseModel):
    baseline_top_box_pct: float
    final_top_box_pct: float
    network_delta_pp: float
    steps: list[StepMetric]
    high_store_months: list[dict[str, Any]]
    store_impact_series: list[dict[str, Any]]
    echo_config: PipelineConfig
    meta: dict[str, Any]
