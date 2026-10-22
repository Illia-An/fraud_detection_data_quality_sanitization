"""Wire the read-only kitchen aggregate to the before/after response."""

from __future__ import annotations

from datetime import date

from backend.tts_kitchen_queries import (
    KITCHEN_PERIOD_END,
    KITCHEN_PERIOD_START,
    load_tts_kitchen_month_cells_from_settings,
)
from backend.tts_kitchen_schemas import (
    KitchenBeforeAfterResponse,
    KitchenLevelOut,
    KitchenMeitOut,
    KitchenMonthOut,
    KitchenStoreOut,
)
from tts_kitchen.fold import KitchenLevelStats, kitchen_delta_sec
from tts_kitchen.report import KitchenBeforeAfter


def _level_out(level: KitchenLevelStats) -> KitchenLevelOut:
    return KitchenLevelOut(
        rows_in=level.rows_in,
        rows_dropped=level.rows_dropped,
        pct_dropped=level.pct_dropped,
        mean_before_sec=level.mean_before_sec,
        mean_after_sec=level.mean_after_sec,
        delta_sec=kitchen_delta_sec(level),
    )


def kitchen_response_from_report(
    report: KitchenBeforeAfter,
    *,
    period_start: date,
    period_end: date,
    tts_min_sec: int,
) -> KitchenBeforeAfterResponse:
    return KitchenBeforeAfterResponse(
        period_start=period_start,
        period_end=period_end,
        tts_min_sec=tts_min_sec,
        network=_level_out(report.network),
        network_months=[
            KitchenMonthOut(
                year=month.year,
                month=month.month,
                mean_before_sec=month.mean_before_sec,
                mean_after_sec=month.mean_after_sec,
            )
            for month in report.network_months
        ],
        by_store=[
            KitchenStoreOut(
                store_id=store.store_id,
                months=[
                    KitchenMonthOut(
                        year=month.year,
                        month=month.month,
                        mean_before_sec=month.mean_before_sec,
                        mean_after_sec=month.mean_after_sec,
                    )
                    for month in store.months
                ],
                **_level_out(store.stats).model_dump(),
            )
            for store in report.by_store
        ],
        by_meit=[
            KitchenMeitOut(
                meit_number=item.meit_number,
                **_level_out(item).model_dump(),
            )
            for item in report.by_meit
        ],
    )


def run_tts_kitchen_before_after(min_sec: int = 30) -> KitchenBeforeAfterResponse:
    """Read the fixed window once at ``min_sec`` and fold it. The view is not modified."""
    from tts_kitchen.report import assemble_kitchen_before_after

    if isinstance(min_sec, bool) or not isinstance(min_sec, int) or min_sec < 0:
        raise ValueError(f"min_sec must be an integer >= 0, got {min_sec!r}")
    cells, _query_time_ms = load_tts_kitchen_month_cells_from_settings(min_sec=min_sec)
    report = assemble_kitchen_before_after(cells)
    return kitchen_response_from_report(
        report,
        period_start=KITCHEN_PERIOD_START,
        period_end=KITCHEN_PERIOD_END,
        tts_min_sec=min_sec,
    )
