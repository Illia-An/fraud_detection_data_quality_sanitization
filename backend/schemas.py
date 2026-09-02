"""Pydantic v2 contracts for Fraud Guard sanitization PoC API.

Architecture contract (Agent 1):
- POST /api/v1/process accepts ``ProcessRequest`` (survey rows + pipeline config).
- Returns ``ProcessResponse`` with step metrics, store-month panel, and KPI deltas.
- GET /health returns ``HealthResponse``.
- Physical column names match ``SummerCampain.dbo.TargetsByMetrics_RateGetAnswers``.
- Frontend TypeScript mirrors this module in ``frontend/models/api.interface.ts``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Input: single survey answer row (RateGetAnswers shape)
# ---------------------------------------------------------------------------


class SurveyAnswerRow(BaseModel):
    """One answered survey row. Extra columns are preserved for downstream mapping."""

    model_config = ConfigDict(extra="allow")

    ParticipateNumber: str | None = None
    Question_ID: int = Field(default=10012, ge=1)
    Answer_Value: int | None = Field(default=None, ge=1, le=5)
    BlackList: str | None = None
    UserContact: str | None = None
    PhoneFromLog: str | None = None
    ext_user_id: int | None = None
    PrintStore: float | int | None = None
    AnswerTime: datetime | str | None = None
    PrintDateTime: datetime | str | None = None
    Year: int | None = Field(default=None, ge=2000, le=2100)
    Month: int | None = Field(default=None, ge=1, le=12)


# ---------------------------------------------------------------------------
# Pipeline configuration (Tier 1 / 2 / 3 toggles & thresholds)
# ---------------------------------------------------------------------------


class Tier1Options(BaseModel):
    """Deterministic rules: blacklist, freq store×day, optional always-topbox."""

    enable_blacklist: bool = True
    enable_freq_store_day: bool = True
    enable_always_topbox: bool = False
    freq_store_day_min: int = Field(default=3, ge=2, le=20)
    always_topbox_min_n: int = Field(default=10, ge=3, le=100)
    customer_blacklist_value: str = Field(default="לא")


class Tier2Options(BaseModel):
    """Store×month z-score / high five_pct rule (after Tier 1)."""

    enabled: bool = True
    min_volume: int = Field(default=30, ge=1, le=10_000)
    z_high: float = Field(default=2.0, ge=0.5, le=5.0)
    five_pct_min: float = Field(default=90.0, ge=50.0, le=100.0)


class Tier3Options(BaseModel):
    """IsolationForest on entity profiles (optional, off by default for MVP)."""

    enabled: bool = False
    contamination: float = Field(default=0.005, ge=0.001, le=0.1)
    min_entity_n: int = Field(default=3, ge=2, le=50)
    n_estimators: int = Field(default=200, ge=50, le=500)
    random_state: int = Field(default=42, ge=0)


class PipelineConfig(BaseModel):
    """Full sanitization pipeline options."""

    tier1: Tier1Options = Field(default_factory=Tier1Options)
    tier2: Tier2Options = Field(default_factory=Tier2Options)
    tier3: Tier3Options = Field(default_factory=Tier3Options)


class ProcessRequest(BaseModel):
    """Payload for POST /api/v1/process."""

    rows: list[SurveyAnswerRow] = Field(..., min_length=1, max_length=500_000)
    config: PipelineConfig = Field(default_factory=PipelineConfig)

    @field_validator("rows")
    @classmethod
    def require_at_least_one_answer(cls, rows: list[SurveyAnswerRow]) -> list[SurveyAnswerRow]:
        if not rows:
            raise ValueError("rows must not be empty")
        return rows


# ---------------------------------------------------------------------------
# Output: pipeline metrics & panels
# ---------------------------------------------------------------------------


class StepMetrics(BaseModel):
    """Row accounting and top-box rate after one pipeline stage."""

    step_name: str
    rows_in: int = Field(ge=0)
    rows_out: int = Field(ge=0)
    rows_dropped: int = Field(ge=0)
    top_box_rate_pct: float | None = None
    drop_reasons: dict[str, int] = Field(default_factory=dict)


class StoreMonthCell(BaseModel):
    """Store × year × month aggregate used by Tier 2."""

    store_id: float
    year: int
    month: int
    volume: int = Field(ge=0)
    five_pct: float
    z: float
    flagged: bool = False


class StoreImpactPoint(BaseModel):
    """Per-store monthly 5% before/after each pipeline stage."""

    store_id: float
    year: int
    month: int
    period_label: str
    actual_five_pct: float
    after_tier1_five_pct: float | None = None
    after_tier2_five_pct: float | None = None
    after_tier3_five_pct: float | None = None
    actual_volume: int = Field(ge=0)
    final_volume: int = Field(ge=0)
    rows_dropped: int = Field(ge=0)


class ProcessResponse(BaseModel):
    """Sanitization result returned to the UI."""

    baseline_top_box_pct: float | None = None
    final_top_box_pct: float | None = None
    network_delta_pp: float | None = None
    steps: list[StepMetrics] = Field(default_factory=list)
    high_store_months: list[StoreMonthCell] = Field(default_factory=list)
    store_impact_series: list[StoreImpactPoint] = Field(default_factory=list)
    entities_flagged_tier3: int = Field(default=0, ge=0)
    meta: dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """GET /health payload."""

    status: str = "ok"
    version: str = "0.1.0"


class SamplePresetMeta(BaseModel):
    """Metadata for synthetic sample presets."""

    preset: str
    row_count: int
    store_count: int
    month_count: int
    description: str


class SampleResponse(BaseModel):
    """GET /api/v1/sample/{preset} payload."""

    preset: str
    rows: list[SurveyAnswerRow]
    meta: SamplePresetMeta


class ErrorDetail(BaseModel):
    """Structured validation / server error body."""

    detail: str | list[dict[str, Any]]
