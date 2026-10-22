"""Plan API contracts for monthly TTS minutes (lower is better).

Working bounds, same as ``plan_tts``: floor 0 min, ceiling 30 min,
default step 0.25 min / month, default target 3.5 min.
Read-only with respect to the source KPI table: the request carries a
baseline snapshot and the response is a projection, never a DB write.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.plan_schemas import MonthScoreOut, StoreProjectionOut

TTS_FLOOR_MIN = 0.0
TTS_CEILING_MIN = 30.0


class TtsPlanBaselineRow(BaseModel):
    store_id: int
    tts: float = Field(ge=TTS_FLOOR_MIN, le=TTS_CEILING_MIN)


class TtsPlanParams(BaseModel):
    trajectory: Literal["uniform", "front_loaded", "accelerated"] = "uniform"
    trajectory_power: float = Field(default=2.0, ge=0.1)
    priority_power: float = Field(default=1.0, ge=0.1)
    max_monthly_improve: float = Field(default=0.25, ge=0.01)
    growth_factor: float = Field(default=0.5, ge=0.0, le=1.0)


class TtsPlanRequest(BaseModel):
    """Run a TTS minute plan on a monthly KPI baseline snapshot."""

    reference_year: int = Field(ge=2000, le=2100)
    reference_month: int = Field(ge=1, le=12)
    horizon: int = Field(default=12, ge=1, le=12)
    target: float = Field(default=3.5, ge=TTS_FLOOR_MIN, le=TTS_CEILING_MIN)
    params: TtsPlanParams = Field(default_factory=TtsPlanParams)
    baseline_rows: list[TtsPlanBaselineRow] = Field(min_length=1)

    @model_validator(mode="after")
    def _target_must_improve(self) -> TtsPlanRequest:
        scores = [row.tts for row in self.baseline_rows]
        current = sum(scores) / len(scores)
        if self.target > current + 1e-9:
            raise ValueError(
                "Target must improve in the selected metric direction "
                f"(current chain {current:.2f} min, target {self.target:.2f} min)."
            )
        return self


class TtsPlanOut(BaseModel):
    metric_id: Literal["tts"] = "tts"
    unit: Literal["min"] = "min"
    direction: Literal["lower_is_better"] = "lower_is_better"
    target: float
    current_chain: float
    required_change: float
    final_chain: float
    feasible: bool
    chain_trajectory: list[MonthScoreOut]
    projections: list[StoreProjectionOut]


class TtsPlanResponse(BaseModel):
    metrics: dict[str, TtsPlanOut]


class TtsKpiPanelRowOut(BaseModel):
    """One store × year × month cell. ``tts`` is minutes, not seconds."""

    store_id: int = Field(ge=0, le=499)
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    tts: float = Field(ge=TTS_FLOOR_MIN, le=TTS_CEILING_MIN)


class TtsKpiPanelResponse(BaseModel):
    """Synthetic monthly TTS panel. Reference month is the latest month in ``rows``."""

    preset: Literal["small", "medium", "stress"]
    period_start: str
    period_end: str
    reference_year: int
    reference_month: int = Field(ge=1, le=12)
    row_count: int = Field(ge=1)
    rows: list[TtsKpiPanelRowOut]


class TtsKpiApPanelResponse(BaseModel):
    """AP export of avg_serve_time_minutes. Same row shape as the synthetic panel."""

    preset: Literal["ap"] = "ap"
    source: Literal["ap"] = "ap"
    period_start: str
    period_end: str
    reference_year: int
    reference_month: int = Field(ge=1, le=12)
    row_count: int = Field(ge=1)
    rows: list[TtsKpiPanelRowOut]
