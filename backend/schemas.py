"""Pydantic v2 contracts for the sanitization PoC API.

Architecture contract:
- POST /api/v1/process accepts ``ProcessRequest`` (inline rows, or ``source=db``
  for the configured AnswerTime window; optional ``from_date`` / ``to_date``).
- Returns ``SanitizationResponse`` with step metrics, store-month panel, KPI deltas, and ``echo_config``.
- GET /health returns ``HealthResponse``.
- Physical column names match ``SummerCampain.dbo.TargetsByMetrics_RateGetAnswers``.
- Shared pipeline contracts live in ``src/schemas`` (SPEC.md Section 2).
- Frontend TypeScript mirrors this module in ``web/src/schemas/api.ts``.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field, model_validator

from schemas import PipelineConfig, SanitizationResponse, StepMetric


class ResponseMeta(TypedDict, total=False):
    """Telemetry keys merged into ``SanitizationResponse.meta`` (SPEC §5.3)."""

    execution_time_ms: float
    peak_memory_mb: float
    rows_scanned: int
    db_query_a_time_ms: float
    db_query_b_time_ms: float
    processed_at: str
    input_rows: int
    answered_rows: int
    source: str
    sample: dict[str, Any]
    drop_reasons: dict[str, Any]
    period_start: str
    period_end: str | None

# Transitional aliases for callers not yet migrated off legacy names.
ProcessResponse = SanitizationResponse
StepMetrics = StepMetric

__all__ = [
    "SurveyAnswerRow",
    "PipelineConfig",
    "ProcessRequest",
    "StepMetric",
    "StepMetrics",
    "StoreMonthCell",
    "StoreImpactPoint",
    "SanitizationResponse",
    "ProcessResponse",
    "ResponseMeta",
    "HealthResponse",
    "SamplePresetMeta",
    "SampleResponse",
    "ErrorDetail",
]


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
# Pipeline configuration — see ``schemas.PipelineConfig`` (SPEC Section 2)
# ---------------------------------------------------------------------------


class ProcessRequest(BaseModel):
    """Payload for POST /api/v1/process.

    ``source=inline`` (default): client sends survey ``rows``.
    ``source=db``: server loads Q10012 for ``from_date``..``to_date``
    (defaults: ``DEFAULT_FROM_DATE`` through latest when omitted).
    """

    source: Literal["inline", "db"] = "inline"
    rows: list[SurveyAnswerRow] = Field(default_factory=list, max_length=500_000)
    config: PipelineConfig = Field(default_factory=PipelineConfig)
    from_date: date | None = Field(
        default=None,
        description="Inclusive AnswerTime lower bound (source=db). Default: 2025-01-01.",
    )
    to_date: date | None = Field(
        default=None,
        description="Inclusive AnswerTime upper bound (source=db). Omit for open-ended.",
    )

    @model_validator(mode="after")
    def require_rows_for_inline(self) -> ProcessRequest:
        if self.source == "inline" and not self.rows:
            raise ValueError("rows must not be empty")
        if (
            self.from_date is not None
            and self.to_date is not None
            and self.from_date > self.to_date
        ):
            raise ValueError("from_date must be on or before to_date")
        return self


# ---------------------------------------------------------------------------
# Output helpers (typed dict shapes used before serialization to list[dict])
# ---------------------------------------------------------------------------


class StoreMonthCell(BaseModel):
    """Store × year × month aggregate used by Tier 4 (store×month anomaly)."""

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
    after_tier4_five_pct: float | None = None
    actual_volume: int = Field(ge=0)
    final_volume: int = Field(ge=0)
    rows_dropped: int = Field(ge=0)


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
