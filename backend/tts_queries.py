"""Read-only TTS Query A helpers (SPEC-tts Stage 1).

Source: ``MC.dbo.TargetsByMetrics_McKitiBump`` (override via ``TTS_VIEW``).
Period filter uses business day ``SaleDate`` (inclusive calendar bounds).
No ``SELECT *`` — audit columns only (Invariant T4).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Sequence

import pandas as pd
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

DEFAULT_TTS_VIEW = "dbo.TargetsByMetrics_McKitiBump"

# Audit-approved columns for bump-row fetches (Stage 2+). Never SELECT *.
TTS_AUDIT_COLUMNS: tuple[str, ...] = (
    "StoreIndex",
    "SaleDate",
    "WeborderID",
    "KVSGroup",
    "MeitNumber",
    "SortOrder",
    "UpDatetime",
    "BumpDateTime",
)


@dataclass(frozen=True)
class TtsStorePeriodAggregate:
    """One store × year × month cell from TTS Query A (no raw bump rows)."""

    store_id: int
    year: int
    month: int
    bump_count: int
    sum_tts_sec: float
    mean_tts_sec: float


@dataclass(frozen=True)
class TtsActualBaseline:
    """Network-level actual TTS from Query A aggregates only."""

    bump_count: int
    mean_tts_sec: float
    by_store_period: tuple[TtsStorePeriodAggregate, ...]
    query_time_ms: float = 0.0


class TtsQueryError(RuntimeError):
    """TTS SQL / config failure (mirrors DbSampleError role for Q10012)."""

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


# Soft default for TTS SaleDate window (research coverage starts ~2026-09).
DEFAULT_TTS_FROM_DATE = date(2026, 9, 1)


def network_mean_tts_sec(sum_tts_sec: float, bump_count: int) -> float:
    """Row-weighted network mean TTS in seconds (4 decimal places)."""
    if bump_count <= 0:
        return 0.0
    return round(float(sum_tts_sec) / bump_count, 4)


def baseline_from_tts_aggregates(
    rows: Sequence[TtsStorePeriodAggregate],
    *,
    query_time_ms: float = 0.0,
) -> TtsActualBaseline:
    """Fold store×period aggregates into network baseline (pure, no I/O)."""
    total = sum(r.bump_count for r in rows)
    sum_tts = sum(r.sum_tts_sec for r in rows)
    return TtsActualBaseline(
        bump_count=total,
        mean_tts_sec=network_mean_tts_sec(sum_tts, total),
        by_store_period=tuple(rows),
        query_time_ms=query_time_ms,
    )


def _store_ids_clause(
    store_ids: Sequence[int | float] | None,
    params: dict[str, Any],
) -> str:
    if not store_ids:
        return ""
    placeholders: list[str] = []
    for i, sid in enumerate(store_ids):
        key = f"store_id_{i}"
        params[key] = int(sid)
        placeholders.append(f":{key}")
    return f"  AND StoreIndex IN ({', '.join(placeholders)})\n"


def _sale_date_period_clause(
    period_start: date,
    period_end: date | None,
    params: dict[str, Any],
) -> str:
    """Inclusive SaleDate window: [period_start, period_end] calendar days."""
    params["period_start"] = period_start.isoformat()
    clause = "  AND SaleDate >= :period_start\n"
    if period_end is not None:
        # Exclusive upper bound of next day → inclusive of period_end.
        params["period_end_exclusive"] = (period_end + timedelta(days=1)).isoformat()
        clause += "  AND SaleDate < :period_end_exclusive\n"
    return clause


def build_tts_actual_baseline_sql(
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
    *,
    view_name: str = DEFAULT_TTS_VIEW,
) -> tuple[str, dict[str, Any]]:
    """Build TTS Query A — store×month mean/sum TTS; bump rows with valid bump time."""
    params: dict[str, Any] = {}
    where = "WHERE BumpDateTime IS NOT NULL\n"
    where += _sale_date_period_clause(period_start, period_end, params)
    where += _store_ids_clause(store_ids, params)

    # DATEDIFF SECOND — SQL Server; TTS_sec definition (SPEC-tts Invariant T1).
    tts_expr = "DATEDIFF(SECOND, UpDatetime, BumpDateTime)"
    sql = f"""
SELECT
    StoreIndex AS store_id,
    YEAR(SaleDate) AS [year],
    MONTH(SaleDate) AS [month],
    COUNT(*) AS bump_count,
    SUM(CAST(({tts_expr}) AS FLOAT)) AS sum_tts_sec,
    AVG(CAST(({tts_expr}) AS FLOAT)) AS mean_tts_sec
FROM {view_name}
{where}GROUP BY StoreIndex, YEAR(SaleDate), MONTH(SaleDate)
ORDER BY StoreIndex, YEAR(SaleDate), MONTH(SaleDate)
"""
    return sql, params


def build_tts_bump_rows_sql(
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
    *,
    view_name: str = DEFAULT_TTS_VIEW,
) -> tuple[str, dict[str, Any]]:
    """Stage 2 prep: audit-column SELECT for bump rows (no SELECT *)."""
    params: dict[str, Any] = {}
    cols = ",\n    ".join(TTS_AUDIT_COLUMNS)
    where = "WHERE BumpDateTime IS NOT NULL\n"
    where += _sale_date_period_clause(period_start, period_end, params)
    where += _store_ids_clause(store_ids, params)
    sql = f"""
SELECT
    {cols}
FROM {view_name}
{where}
"""
    return sql, params


def get_tts_actual_baseline_aggregates(
    engine: Engine,
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
    *,
    view_name: str | None = None,
) -> TtsActualBaseline:
    """TTS Query A — store×month aggregates; no raw bump rows retained beyond fold."""
    from db.config import get_settings

    resolved_view = view_name or get_settings().tts_view
    sql, params = build_tts_actual_baseline_sql(
        period_start,
        period_end,
        store_ids=store_ids,
        view_name=resolved_view,
    )
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            mappings = list(result.mappings())
    except SQLAlchemyError as exc:
        logger.exception("TTS Query A (actual baseline aggregates) failed")
        raise TtsQueryError("TTS database query failed") from exc
    query_time_ms = (time.perf_counter() - started) * 1000.0

    aggregates: list[TtsStorePeriodAggregate] = []
    for row in mappings:
        store_raw = row.get("store_id")
        year_raw = row.get("year")
        month_raw = row.get("month")
        if store_raw is None or year_raw is None or month_raw is None:
            continue
        bump_count = int(row.get("bump_count") or 0)
        sum_tts = float(row.get("sum_tts_sec") or 0.0)
        mean_raw = row.get("mean_tts_sec")
        mean_tts = (
            float(mean_raw)
            if mean_raw is not None
            else network_mean_tts_sec(sum_tts, bump_count)
        )
        aggregates.append(
            TtsStorePeriodAggregate(
                store_id=int(store_raw),
                year=int(year_raw),
                month=int(month_raw),
                bump_count=bump_count,
                sum_tts_sec=sum_tts,
                mean_tts_sec=round(mean_tts, 4),
            )
        )
    return baseline_from_tts_aggregates(aggregates, query_time_ms=query_time_ms)


def load_tts_actual_baseline_from_settings(
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
) -> TtsActualBaseline:
    """TTS Query A using ``TTS_DATABASE_URL`` (fallback ``DATABASE_URL``)."""
    from db.connection import get_tts_engine

    return get_tts_actual_baseline_aggregates(
        get_tts_engine(),
        period_start,
        period_end,
        store_ids=store_ids,
    )


def get_tts_bump_rows(
    engine: Engine,
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
    *,
    view_name: str | None = None,
) -> tuple[pd.DataFrame, float]:
    """Load audit-column bump rows for the TTS engine (Stage 3).

    Returns ``(dataframe, query_time_ms)``. Only ``TTS_AUDIT_COLUMNS``.
    """
    from db.config import get_settings

    resolved_view = view_name or get_settings().tts_view
    sql, params = build_tts_bump_rows_sql(
        period_start,
        period_end,
        store_ids=store_ids,
        view_name=resolved_view,
    )
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            rows = [dict(m) for m in result.mappings()]
    except SQLAlchemyError as exc:
        logger.exception("TTS bump-row fetch failed")
        raise TtsQueryError("TTS database query failed") from exc
    query_time_ms = (time.perf_counter() - started) * 1000.0
    return pd.DataFrame(rows), query_time_ms


def load_tts_bump_rows_from_settings(
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
) -> tuple[pd.DataFrame, float]:
    """Bump rows via ``get_tts_engine()``."""
    from db.connection import get_tts_engine

    return get_tts_bump_rows(
        get_tts_engine(),
        period_start,
        period_end,
        store_ids=store_ids,
    )
