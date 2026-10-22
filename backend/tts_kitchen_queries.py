"""Read-only kitchen before/after aggregate.

One ``SELECT`` of ``TTS_VIEW``. Grouped by store, item code, and month so the
network, the stores, and the item codes can be summed in Python without a
second scan. No writes and no joins.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import date, timedelta
from typing import Any

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from tts_kitchen.report import KitchenMonthCell

logger = logging.getLogger(__name__)

# Inclusive SaleDate window. The live view grows, so the screen uses this slice.
KITCHEN_PERIOD_START = date(2026, 9, 1)
KITCHEN_PERIOD_END = date(2026, 10, 20)
# Shorter than this is dropped. Exactly this many seconds stays.
KITCHEN_MIN_SEC = 30

_VIEW_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")
_TTS_EXPR = "DATEDIFF(SECOND, UpDatetime, BumpDateTime)"


class KitchenReadError(RuntimeError):
    """Kitchen SQL read failed. The source view is left unchanged."""

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


def _require_view_name(view_name: str) -> str:
    if not _VIEW_NAME.fullmatch(view_name):
        raise ValueError(f"invalid TTS view name: {view_name!r}")
    return view_name


def _require_min_sec(min_sec: int) -> int:
    if isinstance(min_sec, bool) or not isinstance(min_sec, int) or min_sec < 0:
        raise ValueError(f"min_sec must be an integer >= 0, got {min_sec!r}")
    return min_sec


def build_tts_kitchen_before_after_sql(
    period_start: date,
    period_end: date,
    *,
    view_name: str,
    min_sec: int = KITCHEN_MIN_SEC,
) -> tuple[str, dict[str, str | int]]:
    """One read-only aggregate. Dates and the cut are bound parameters.

    ``period_end`` is inclusive. The predicate uses the next calendar day.
    Rows shorter than ``min_sec`` are dropped. Rows of exactly ``min_sec`` stay.
    """
    if period_start > period_end:
        raise ValueError("period_start must be on or before period_end")
    view = _require_view_name(view_name)
    cut = _require_min_sec(min_sec)
    params: dict[str, str | int] = {
        "period_start": period_start.isoformat(),
        "period_end_exclusive": (period_end + timedelta(days=1)).isoformat(),
        "min_sec": cut,
    }
    sql = f"""
SELECT
    StoreIndex,
    MeitNumber,
    YEAR(SaleDate) AS [year],
    MONTH(SaleDate) AS [month],
    COUNT(*) AS rows_in,
    SUM(CASE WHEN tts < :min_sec THEN 1 ELSE 0 END) AS rows_dropped,
    SUM(CAST(tts AS float)) AS sum_before,
    SUM(CASE WHEN tts >= :min_sec THEN CAST(tts AS float) ELSE 0 END) AS sum_after,
    SUM(CASE WHEN tts >= :min_sec THEN 1 ELSE 0 END) AS rows_after
FROM (
    SELECT
        StoreIndex,
        MeitNumber,
        SaleDate,
        {_TTS_EXPR} AS tts
    FROM {view}
    WHERE BumpDateTime IS NOT NULL
      AND {_TTS_EXPR} IS NOT NULL
      AND SaleDate >= :period_start
      AND SaleDate < :period_end_exclusive
) AS kitchen_bumps
GROUP BY StoreIndex, MeitNumber, YEAR(SaleDate), MONTH(SaleDate)
"""
    return sql, params


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


def _required_int(value: Any, name: str) -> int:
    if value is None:
        raise ValueError(f"kitchen aggregate is missing {name}")
    return int(value)


def _float_or_zero(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def _cell_from_mapping(row: dict[str, Any]) -> KitchenMonthCell | None:
    store_raw = row.get("StoreIndex")
    if store_raw is None:
        return None
    return KitchenMonthCell(
        store_id=int(store_raw),
        meit_number=_optional_int(row.get("MeitNumber")),
        year=_required_int(row.get("year"), "year"),
        month=_required_int(row.get("month"), "month"),
        rows_in=_required_int(row.get("rows_in"), "rows_in"),
        rows_dropped=_required_int(row.get("rows_dropped"), "rows_dropped"),
        sum_before_sec=_float_or_zero(row.get("sum_before")),
        sum_after_sec=_float_or_zero(row.get("sum_after")),
        rows_after=_required_int(row.get("rows_after"), "rows_after"),
    )


def fetch_tts_kitchen_month_cells(
    engine: Engine,
    *,
    view_name: str,
    period_start: date = KITCHEN_PERIOD_START,
    period_end: date = KITCHEN_PERIOD_END,
    min_sec: int = KITCHEN_MIN_SEC,
) -> tuple[tuple[KitchenMonthCell, ...], float]:
    """Run the one kitchen SELECT. Raises ``KitchenReadError`` on SQL failure."""
    sql, params = build_tts_kitchen_before_after_sql(
        period_start,
        period_end,
        view_name=view_name,
        min_sec=min_sec,
    )
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            mappings = [dict(row) for row in result.mappings()]
    except SQLAlchemyError as exc:
        logger.exception("Kitchen before/after read failed")
        raise KitchenReadError("Kitchen before/after read failed") from exc
    query_time_ms = (time.perf_counter() - started) * 1000.0
    cells = []
    for row in mappings:
        cell = _cell_from_mapping(row)
        if cell is not None and cell.rows_in > 0:
            cells.append(cell)
    return tuple(cells), query_time_ms


def load_tts_kitchen_month_cells_from_settings(
    min_sec: int = KITCHEN_MIN_SEC,
) -> tuple[tuple[KitchenMonthCell, ...], float]:
    """One engine, one SELECT, fixed period. No second connection on failure."""
    from db.config import get_settings
    from db.connection import get_tts_engine

    settings = get_settings()
    engine = get_tts_engine()
    return fetch_tts_kitchen_month_cells(
        engine,
        view_name=settings.tts_view,
        period_start=KITCHEN_PERIOD_START,
        period_end=KITCHEN_PERIOD_END,
        min_sec=min_sec,
    )
