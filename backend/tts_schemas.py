"""API contracts for POST /api/v1/process-tts (SPEC-tts Stage 3)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from schemas.tts import (
    TtsPipelineConfig,
    TtsSanitizationResult,
    TtsStepMetric,
    TtsStoreImpactPoint,
)

# Response model name aligned with SPEC-tts Section 2.
TtsSanitizationResponse = TtsSanitizationResult

__all__ = [
    "TtsBumpRow",
    "TtsProcessRequest",
    "TtsPipelineConfig",
    "TtsStepMetric",
    "TtsStoreImpactPoint",
    "TtsSanitizationResponse",
    "TtsSanitizationResult",
    "TtsSamplePresetMeta",
    "TtsSampleResponse",
]


class TtsBumpRow(BaseModel):
    """One McKitiBump event row (audit columns). Extra fields allowed."""

    model_config = ConfigDict(extra="allow")

    StoreIndex: int
    SaleDate: datetime | date | str
    WeborderID: str
    UpDatetime: datetime | str
    BumpDateTime: datetime | str | None = None
    KVSGroup: int | None = None
    MeitNumber: int | None = None
    SortOrder: int | None = None


class TtsProcessRequest(BaseModel):
    """Payload for POST /api/v1/process-tts."""

    source: Literal["inline", "db"] = "db"
    rows: list[TtsBumpRow] = Field(default_factory=list, max_length=2_000_000)
    config: TtsPipelineConfig = Field(default_factory=TtsPipelineConfig)
    from_date: date | None = Field(
        default=None,
        description="Inclusive SaleDate lower bound (source=db). Default: 2026-09-01.",
    )
    to_date: date | None = Field(
        default=None,
        description="Inclusive SaleDate upper bound (source=db). Omit for open-ended.",
    )
    store_ids: list[int] | None = Field(
        default=None,
        description="Optional StoreIndex filter.",
    )

    @model_validator(mode="after")
    def validate_source_rows_and_period(self) -> TtsProcessRequest:
        if self.source == "inline" and not self.rows:
            raise ValueError("rows must not be empty when source=inline")
        if (
            self.from_date is not None
            and self.to_date is not None
            and self.from_date > self.to_date
        ):
            raise ValueError("from_date must be on or before to_date")
        return self


class TtsSamplePresetMeta(BaseModel):
    preset: str
    row_count: int
    store_count: int
    month_count: int
    description: str


class TtsSampleResponse(BaseModel):
    """GET /api/v1/sample/tts/{preset} payload."""

    preset: str
    rows: list[TtsBumpRow]
    meta: TtsSamplePresetMeta
