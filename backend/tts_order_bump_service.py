"""Wire inline Order × Bump rows → ``process_order_bump_rows`` (Stage OB-3)."""

from __future__ import annotations

from typing import Any

from backend.profiler import profile_block, profiling_meta
from backend.tts_order_bump_schemas import (
    OrderBumpKpi,
    OrderBumpKvsStatsOut,
    OrderBumpOrderStatsOut,
    OrderBumpPipelineConfig,
    OrderBumpProcessRequest,
    OrderBumpProcessResponse,
    OrderBumpStoreAnomalyOut,
    OrderBumpStoreMonthOut,
)
from tts_order_bump.engine import process_order_bump_rows

DB_SOURCE_NOT_READY = (
    "Order×Bump source=db is not available until the DBA mart "
    "(dbo.V_TTS_OrderBump) is delivered. Use source=inline with synthetic rows."
)


def run_tts_order_bump_process(
    request: OrderBumpProcessRequest,
) -> OrderBumpProcessResponse:
    """Execute Order × Bump impact engine for ``/process-tts-order-bump``."""
    if request.source == "db":
        raise ValueError(DB_SOURCE_NOT_READY)

    cfg = OrderBumpPipelineConfig.model_validate(request.config.model_dump())
    rows = [r.model_dump(mode="python") for r in request.rows]

    with profile_block() as profile:
        result = process_order_bump_rows(rows, tts_min_sec=float(cfg.tts_min_sec))

    engine_meta: dict[str, Any] = dict(result["meta"])
    kpi = OrderBumpKpi(
        pct_bumps_dropped_lt30=engine_meta.get("pct_bumps_dropped_lt30"),
        bump_mean_raw_sec=engine_meta.get("bump_mean_raw_sec"),
        bump_mean_ge30_sec=engine_meta.get("bump_mean_ge30_sec"),
        kitchen_mean_raw_sec=engine_meta.get("kitchen_mean_raw_sec"),
        kitchen_mean_ge30_sec=engine_meta.get("kitchen_mean_ge30_sec"),
        cycle_mean_sec=engine_meta.get("cycle_mean_sec"),
        pct_orders_excluded_ge30=engine_meta.get("pct_orders_excluded_ge30"),
        order_tts_penalty_sec=float(engine_meta.get("order_tts_penalty_sec") or 0.0),
        order_tts_weight=float(engine_meta.get("order_tts_weight") or 1.0),
        order_tts_mean_sec=engine_meta.get("order_tts_mean_sec"),
        order_tts_mean_after_sec=engine_meta.get("order_tts_mean_after_sec"),
        order_count=int(engine_meta.get("order_count") or 0),
        order_count_raw=int(engine_meta.get("order_count_raw") or 0),
        order_count_ge30=int(engine_meta.get("order_count_ge30") or 0),
        order_count_cycle=int(engine_meta.get("order_count_cycle") or 0),
        bump_valid_count=int(engine_meta.get("bump_valid_count") or 0),
        bump_ge30_count=int(engine_meta.get("bump_ge30_count") or 0),
        bump_lt30_count=int(engine_meta.get("bump_lt30_count") or 0),
    )

    meta: dict[str, Any] = {
        **engine_meta,
        "source": request.source,
        "source_view": "synthetic.V_TTS_OrderBump_PoC",
        **profiling_meta(
            execution_time_ms=float(profile["execution_time_ms"]),
            peak_memory_mb=float(profile["peak_memory_mb"]),
            rows_scanned=int(len(rows)),
        ),
    }

    return OrderBumpProcessResponse(
        echo_config=cfg,
        kpi=kpi,
        orders=[OrderBumpOrderStatsOut.model_validate(o) for o in result["orders"]],
        store_months=[
            OrderBumpStoreMonthOut.model_validate(s) for s in result["store_months"]
        ],
        store_anomaly=[
            OrderBumpStoreAnomalyOut.model_validate(s) for s in result["store_anomaly"]
        ],
        kvs_stats=[
            OrderBumpKvsStatsOut.model_validate(s) for s in result["kvs_stats"]
        ],
        meta=meta,
    )
