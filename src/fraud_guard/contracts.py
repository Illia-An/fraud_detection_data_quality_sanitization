"""Immutable contracts for sanitized metric panels (downstream-agnostic)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FilterStats(BaseModel):
    """Row accounting after read + fraud filters."""

    model_config = ConfigDict(frozen=True)

    rows_read: int = 0
    rows_kept: int = 0
    rows_dropped: int = 0
    drop_reasons: dict[str, int] = Field(default_factory=dict)


class MonthlyMetricRow(BaseModel):
    """Store × year × month grain for 5% / CSAT panels."""

    model_config = ConfigDict(frozen=True)

    store_id: int
    year: int
    month: int
    five_percent: float | None = None
    survey_volume: int | None = None


class SanitizedBundle(BaseModel):
    """Neutral supply payload after guard filters."""

    model_config = ConfigDict(frozen=True)

    rows: tuple[MonthlyMetricRow, ...] = ()
    stats: FilterStats = Field(default_factory=FilterStats)
    meta: dict[str, Any] = Field(default_factory=dict)
