"""Shared sanitization pipeline contracts — SPEC.md Section 2."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PipelineConfig(BaseModel):
    """Effective sanitization thresholds (SPEC Section 2). Legacy keys ignored."""

    model_config = ConfigDict(extra="ignore")

    tier1_blacklist_enabled: bool = True
    tier1_freq_threshold: int = Field(default=3, ge=1)
    tier1_always_five_enabled: bool = False
    tier1_always_five_min_n: int = 10
    tier2_min_volume: int = Field(default=30, ge=1)
    tier2_z_threshold: float = Field(default=2.0, ge=0.0)
    tier2_pct_threshold: float = Field(default=90.0, ge=0.0, le=100.0)


class StepMetric(BaseModel):
    step_name: Literal["actual", "tier1", "tier2"]
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
