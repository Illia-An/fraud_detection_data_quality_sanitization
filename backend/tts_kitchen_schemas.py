"""Response for GET /api/v1/tts-kitchen/before-after. Optional query ``min_sec``."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class KitchenLevelOut(BaseModel):
    """Counts and means in seconds. ``pct_dropped`` is a share from 0 to 1."""

    model_config = ConfigDict(extra="ignore")

    rows_in: int
    rows_dropped: int
    pct_dropped: float | None
    mean_before_sec: float | None
    mean_after_sec: float | None
    delta_sec: float | None


class KitchenMonthOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    year: int
    month: int
    mean_before_sec: float | None
    mean_after_sec: float | None


class KitchenStoreOut(KitchenLevelOut):
    store_id: int
    months: list[KitchenMonthOut]


class KitchenMeitOut(KitchenLevelOut):
    meit_number: int


class KitchenBeforeAfterResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    period_start: date
    period_end: date
    tts_min_sec: int
    network: KitchenLevelOut
    network_months: list[KitchenMonthOut]
    by_store: list[KitchenStoreOut]
    by_meit: list[KitchenMeitOut]
