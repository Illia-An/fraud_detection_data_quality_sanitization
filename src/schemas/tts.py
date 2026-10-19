"""TTS sanitization contracts — SPEC-tts.md Section 2."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

OrderAgg = Literal["none", "avg", "max"]
TtsStepName = Literal["actual", "ge30"]


class TtsPipelineConfig(BaseModel):
    """Effective TTS sanitization settings (echoed on every response)."""

    model_config = ConfigDict(extra="ignore")

    tts_min_sec: int = Field(default=30, ge=0)
    order_agg: OrderAgg = "none"


class TtsStepMetric(BaseModel):
    step_name: TtsStepName
    rows_in: int
    rows_out: int
    rows_dropped: int
    mean_tts_sec: float
    median_tts_sec: float | None = None


class TtsStoreImpactPoint(BaseModel):
    """Store × calendar month cell."""

    store_id: int
    year: int
    month: int
    actual_mean_tts_sec: float | None = None
    after_ge30_mean_tts_sec: float | None = None
    volume_before: int | None = None
    volume_after: int | None = None


class TtsSanitizationResult(BaseModel):
    """Pure-engine result (Stage 2). API wrapper adds request meta in Stage 3."""

    baseline_mean_tts_sec: float
    final_mean_tts_sec: float
    network_delta_sec: float
    steps: list[TtsStepMetric]
    store_impact_series: list[TtsStoreImpactPoint]
    echo_config: TtsPipelineConfig
    meta: dict[str, Any]
