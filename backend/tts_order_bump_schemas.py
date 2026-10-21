"""API contracts for Order × Bump PoC (isolated from McKiti ``/process-tts``)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from tts_order_bump.engine import DEFAULT_TTS_MIN_SEC

__all__ = [
    "OrderBumpRow",
    "OrderBumpPipelineConfig",
    "OrderBumpProcessRequest",
    "OrderBumpKpi",
    "OrderBumpOrderStatsOut",
    "OrderBumpStoreMonthOut",
    "OrderBumpStoreAnomalyOut",
    "OrderBumpKvsStatsOut",
    "OrderBumpProcessResponse",
    "OrderBumpSamplePresetMeta",
    "OrderBumpSampleResponse",
]


class OrderBumpPipelineConfig(BaseModel):
    """ge30 threshold on bump TTS only (seconds)."""

    model_config = ConfigDict(extra="ignore")

    tts_min_sec: float = Field(default=DEFAULT_TTS_MIN_SEC, ge=0)


class OrderBumpRow(BaseModel):
    """One ``V_TTS_OrderBump``-shaped bump row. Extra fields allowed."""

    model_config = ConfigDict(extra="allow")

    store_id: int
    sale_date: str
    order_id: str
    order_key: str
    bump_seq: int
    bump_uid: str
    order_tts_sec: float
    order_is_void: bool = False
    bump_tts_sec: float | None = None
    bump_valid: bool = False
    bump_ge30: bool = False
    join_match: bool = True
    year: int
    month: int


class OrderBumpProcessRequest(BaseModel):
    """Payload for POST /api/v1/process-tts-order-bump."""

    source: Literal["inline", "db"] = "inline"
    rows: list[OrderBumpRow] = Field(default_factory=list, max_length=2_000_000)
    config: OrderBumpPipelineConfig = Field(default_factory=OrderBumpPipelineConfig)

    @model_validator(mode="after")
    def validate_source_rows(self) -> OrderBumpProcessRequest:
        if self.source == "inline" and not self.rows:
            raise ValueError("rows must not be empty when source=inline")
        return self


class OrderBumpKpi(BaseModel):
    """Network-level impact summary for the PoC panel."""

    pct_bumps_dropped_lt30: float | None = None
    bump_mean_raw_sec: float | None = None
    bump_mean_ge30_sec: float | None = None
    kitchen_mean_raw_sec: float | None = None
    kitchen_mean_ge30_sec: float | None = None
    cycle_mean_sec: float | None = None
    pct_orders_excluded_ge30: float | None = None
    order_tts_penalty_sec: float = 0.0
    order_tts_weight: float = 1.0
    order_tts_mean_sec: float | None = None
    order_tts_mean_after_sec: float | None = None
    order_count: int = 0
    order_count_raw: int = 0
    order_count_ge30: int = 0
    order_count_cycle: int = 0
    bump_valid_count: int = 0
    bump_ge30_count: int = 0
    bump_lt30_count: int = 0


class OrderBumpOrderStatsOut(BaseModel):
    store_id: int
    sale_date: str
    order_id: str
    order_key: str
    year: int
    month: int
    order_tts_sec: float
    order_tts_after_sec: float
    bump_tts_sum_lt30_sec: float = 0.0
    order_channel: str | None = None
    order_is_void: bool = False
    bump_count: int
    bump_count_valid: int
    bump_count_ge30: int
    bump_count_lt30: int
    bump_tts_sum_raw_sec: float
    bump_tts_sum_ge30_sec: float
    bump_tts_avg_raw_sec: float | None = None
    bump_tts_avg_ge30_sec: float | None = None
    bump_tts_max_raw_sec: float | None = None
    bump_tts_max_ge30_sec: float | None = None
    pct_bumps_dropped: float | None = None
    has_full_join: bool = False
    cycle_raw_sec: float | None = None


class OrderBumpStoreMonthOut(BaseModel):
    store_id: int
    year: int
    month: int
    order_count: int
    order_tts_mean_sec: float
    order_tts_mean_after_sec: float
    order_tts_median_sec: float | None = None
    bump_volume: int
    bump_volume_ge30: int
    bump_mean_raw_sec: float | None = None
    bump_mean_ge30_sec: float | None = None
    kitchen_mean_raw_sec: float | None = None
    kitchen_mean_ge30_sec: float | None = None
    cycle_mean_sec: float | None = None
    order_count_raw: int = 0
    order_count_ge30: int = 0
    order_count_cycle: int = 0
    pct_orders_excluded_ge30: float | None = None
    pct_orders_with_mckiti: float = 0.0
    pct_bumps_dropped_lt30: float | None = None


class OrderBumpStoreAnomalyOut(BaseModel):
    """Store-level short-bump concentration (Check 3 bridge)."""

    store_id: int
    order_count: int
    bump_valid_count: int
    bump_lt30_count: int
    bump_ge30_count: int
    anomaly_pct: float
    bump_mean_raw_sec: float | None = None
    bump_mean_ge30_sec: float | None = None
    order_tts_mean_sec: float
    order_tts_mean_after_sec: float
    order_tts_delta_sec: float
    alert_high: bool = False


class OrderBumpKvsStatsOut(BaseModel):
    """Bump-grain stats by monitor KVS group (21 / 31)."""

    kvs_group: int
    bump_valid_count: int
    bump_lt30_count: int
    bump_ge30_count: int
    anomaly_pct: float
    bump_mean_raw_sec: float | None = None
    bump_mean_ge30_sec: float | None = None
    bump_median_raw_sec: float | None = None
    lt30_tts_sum_sec: float = 0.0
    pct_of_valid_network: float | None = None
    alert_high: bool = False


class OrderBumpProcessResponse(BaseModel):
    """Aggregates only — raw bump rows are not echoed (use sample endpoint)."""

    echo_config: OrderBumpPipelineConfig
    kpi: OrderBumpKpi
    orders: list[OrderBumpOrderStatsOut] = Field(default_factory=list)
    store_months: list[OrderBumpStoreMonthOut] = Field(default_factory=list)
    store_anomaly: list[OrderBumpStoreAnomalyOut] = Field(default_factory=list)
    kvs_stats: list[OrderBumpKvsStatsOut] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class OrderBumpSamplePresetMeta(BaseModel):
    preset: str
    row_count: int
    order_count: int
    store_count: int
    month_count: int
    valid_bump_count: int
    short_bump_count: int
    short_bump_share: float
    description: str


class OrderBumpSampleResponse(BaseModel):
    """GET /api/v1/sample/tts-order-bump/{preset}."""

    preset: str
    rows: list[OrderBumpRow]
    meta: OrderBumpSamplePresetMeta
