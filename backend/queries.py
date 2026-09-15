"""SQL pushdown queries for sanitization (SPEC Section 5.2 Query A / Query B)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any, Sequence

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from backend.db_sample import (
    DEFAULT_FROM_DATE,
    VIEW_NAME,
    DbSampleError,
    DbSampleQuery,
    SqlDialect,
    _period_params,
    _process_engine,
    redact_row,
)
from backend.schemas import PipelineConfig, SamplePresetMeta, SampleResponse, SurveyAnswerRow
from backend.snapshot import (
    ANSWERS_TABLE,
    STORE_MONTH_TABLE,
    get_sanitization_source,
    meta_as_dict,
    read_meta,
)
from fraud_guard.tier1 import CUSTOMER_BLACKLIST_VALUE

logger = logging.getLogger(__name__)

TOP_BOX_VALUE = 5

# Essential Tier1 columns only (Invariant 4) — no SELECT *.
_QUERY_B_COLUMNS = (
    "ParticipateNumber",
    "Question_ID",
    "Answer_Value",
    "BlackList",
    "UserContact",
    "PhoneFromLog",
    "ext_user_id",
    "PrintStore",
    "AnswerTime",
    "Year",
    "Month",
)


@dataclass(frozen=True)
class StorePeriodAggregate:
    """One store × year × month cell from Query A (no raw rows)."""

    store_id: float
    year: int
    month: int
    total_count: int
    top_box_count: int

    @property
    def top_box_pct(self) -> float:
        if self.total_count <= 0:
            return 0.0
        return round(100.0 * self.top_box_count / self.total_count, 4)


@dataclass(frozen=True)
class ActualBaseline:
    """Network-level actual metrics derived solely from Query A aggregates."""

    total_responses: int
    top_box_count: int
    top_box_pct: float
    by_store_period: tuple[StorePeriodAggregate, ...]


def network_top_box_pct(total_responses: int, top_box_count: int) -> float:
    """Top-box % on 0–100 scale, 4 decimal places (matches pipeline ``_pct``)."""
    if total_responses <= 0:
        return 0.0
    return round(100.0 * top_box_count / total_responses, 4)


def baseline_from_aggregates(
    rows: Sequence[StorePeriodAggregate],
) -> ActualBaseline:
    """Fold store×period aggregates into network ActualBaseline (pure, no I/O)."""
    total = sum(r.total_count for r in rows)
    top = sum(r.top_box_count for r in rows)
    return ActualBaseline(
        total_responses=total,
        top_box_count=top,
        top_box_pct=network_top_box_pct(total, top),
        by_store_period=tuple(rows),
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
        params[key] = sid
        placeholders.append(f":{key}")
    return f"  AND PrintStore IN ({', '.join(placeholders)})\n"


def build_actual_baseline_sql(
    query: DbSampleQuery,
    store_ids: Sequence[int | float] | None = None,
    *,
    dialect: SqlDialect = "mssql",
) -> tuple[str, dict[str, Any]]:
    """Build Query A: aggregates only (Invariant 4 — no SELECT *).

    On ``sqlite`` snapshot: read pre-aggregated ``store_month``.
    On ``mssql`` VIEW: GROUP BY live rows.
    """
    if dialect == "sqlite":
        params: dict[str, Any] = {}
        where = "WHERE 1 = 1\n"
        where += _store_ids_clause(store_ids, params)
        # Snapshot is already filtered to AnswerTime >= DEFAULT; optional year/month.
        if query.year is not None:
            where += "  AND Year = :year\n"
            params["year"] = query.year
        if query.month is not None:
            where += "  AND Month = :month\n"
            params["month"] = query.month
        if query.store is not None:
            where += "  AND PrintStore = :store\n"
            params["store"] = query.store
        sql = f"""
SELECT
    PrintStore AS store_id,
    Year AS year,
    Month AS month,
    total_count,
    top_box_count
FROM {STORE_MONTH_TABLE}
{where}ORDER BY PrintStore, Year, Month
"""
        return sql, params

    where, params = _period_params(query, dialect=dialect)
    # Match filter_answered_metric_rows: Q10012 with non-null Answer_Value.
    where += "  AND Answer_Value IS NOT NULL\n"
    where += _store_ids_clause(store_ids, params)
    year_col = "[Year]"
    month_col = "[Month]"
    sql = f"""
SELECT
    PrintStore AS store_id,
    {year_col} AS [year],
    {month_col} AS [month],
    COUNT(*) AS total_count,
    SUM(CASE WHEN Answer_Value = :top_box THEN 1 ELSE 0 END) AS top_box_count
FROM {VIEW_NAME}
{where}GROUP BY PrintStore, {year_col}, {month_col}
ORDER BY PrintStore, {year_col}, {month_col}
"""
    params["top_box"] = TOP_BOX_VALUE
    return sql, params


def get_actual_baseline_aggregates(
    engine: Engine,
    period_start: date,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
    *,
    dialect: SqlDialect = "mssql",
) -> ActualBaseline:
    """Query A — store×period totals/top-box counts; no raw survey rows in RAM.

    ``period_end`` is inclusive (calendar day), matching ``DbSampleQuery.to_date``.
    """
    query = DbSampleQuery(
        from_date=period_start,
        to_date=period_end,
    )
    sql, params = build_actual_baseline_sql(
        query, store_ids=store_ids, dialect=dialect
    )
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            mappings = list(result.mappings())
    except SQLAlchemyError as exc:
        logger.exception("Query A (actual baseline aggregates) failed")
        raise DbSampleError("Database query failed") from exc

    aggregates: list[StorePeriodAggregate] = []
    for row in mappings:
        store_raw = row.get("store_id")
        year_raw = row.get("year")
        month_raw = row.get("month")
        if store_raw is None or year_raw is None or month_raw is None:
            continue
        aggregates.append(
            StorePeriodAggregate(
                store_id=float(store_raw),
                year=int(year_raw),
                month=int(month_raw),
                total_count=int(row.get("total_count") or 0),
                top_box_count=int(row.get("top_box_count") or 0),
            )
        )
    return baseline_from_aggregates(aggregates)


def load_actual_baseline_from_settings(
    period_start: date = DEFAULT_FROM_DATE,
    period_end: date | None = None,
    store_ids: Sequence[int | float] | None = None,
) -> ActualBaseline:
    """Query A via VIEW or snapshot engine from settings."""
    engine, dialect = _process_engine()
    return get_actual_baseline_aggregates(
        engine,
        period_start,
        period_end,
        store_ids=store_ids,
        dialect=dialect,
    )


# SQLite entity key mirroring ``build_entity_key`` (raw PII; hash happens after fetch).
_SQLITE_ENTITY_KEY_EXPR = """
CASE
  WHEN UserContact IS NOT NULL
       AND TRIM(CAST(UserContact AS TEXT)) NOT IN ('', 'None', 'nan', 'NaT')
    THEN 'c:' || TRIM(CAST(UserContact AS TEXT))
  WHEN PhoneFromLog IS NOT NULL
       AND TRIM(CAST(PhoneFromLog AS TEXT)) NOT IN ('', 'None', 'nan', 'NaT')
    THEN 'p:' || TRIM(CAST(PhoneFromLog AS TEXT))
  WHEN ext_user_id IS NOT NULL AND CAST(ext_user_id AS REAL) != 0
    THEN 'u:' || CAST(CAST(ext_user_id AS INTEGER) AS TEXT)
  ELSE NULL
END
""".strip()


def query_b_mode_for_dialect(dialect: SqlDialect) -> str:
    """``tier1_full`` on snapshot (phase 2); ``blacklist_only`` on VIEW (v1)."""
    return "tier1_full" if dialect == "sqlite" else "blacklist_only"


def build_tier_candidate_sql(
    query: DbSampleQuery,
    config: PipelineConfig,
    store_ids: Sequence[int | float] | None = None,
    *,
    dialect: SqlDialect = "mssql",
) -> tuple[str, dict[str, Any]]:
    """Build Query B candidate SELECT (SPEC §5.2).

    - ``mssql`` (VIEW): v1 blacklist-only — no freq/always-5 CTEs (too slow).
    - ``sqlite`` (snapshot): phase 2 — blacklist ∪ freq≥N ∪ optional always-5.
    """
    if dialect == "sqlite":
        return _build_tier_candidate_sql_phase2(query, config, store_ids)
    return _build_tier_candidate_sql_v1(query, config, store_ids, dialect=dialect)


def _build_tier_candidate_sql_v1(
    query: DbSampleQuery,
    config: PipelineConfig,
    store_ids: Sequence[int | float] | None,
    *,
    dialect: SqlDialect,
) -> tuple[str, dict[str, Any]]:
    where, params = _period_params(query, dialect=dialect)
    where += "  AND Answer_Value IS NOT NULL\n"
    where += _store_ids_clause(store_ids, params)

    cols = ",\n    ".join(_QUERY_B_COLUMNS)
    params["customer_bl"] = CUSTOMER_BLACKLIST_VALUE

    if config.tier1_blacklist_enabled:
        where += "  AND (BlackList IS NULL OR BlackList <> :customer_bl)\n"
    else:
        where += "  AND 1 = 0\n"

    sql = f"""
SELECT
    {cols}
FROM {VIEW_NAME}
{where}ORDER BY AnswerTime ASC
"""
    return sql, params


def _build_tier_candidate_sql_phase2(
    query: DbSampleQuery,
    config: PipelineConfig,
    store_ids: Sequence[int | float] | None,
) -> tuple[str, dict[str, Any]]:
    """Snapshot Query B: rows that Tier1 may drop (blacklist / freq / always-5)."""
    where, params = _period_params(query, dialect="sqlite")
    where += "  AND Answer_Value IS NOT NULL\n"
    where += _store_ids_clause(store_ids, params)

    cols = ",\n    ".join(_QUERY_B_COLUMNS)
    params["customer_bl"] = CUSTOMER_BLACKLIST_VALUE
    params["top_box"] = TOP_BOX_VALUE

    predicates: list[str] = []
    if config.tier1_blacklist_enabled:
        predicates.append("(b.BlackList IS NULL OR b.BlackList <> :customer_bl)")

    freq_cte = ""
    if config.tier1_freq_enabled:
        params["freq_min"] = int(config.tier1_freq_threshold)
        freq_cte = """
, freq_groups AS (
  SELECT entity_key, PrintStore, day
  FROM base
  WHERE entity_key IS NOT NULL
    AND PrintStore IS NOT NULL
    AND day IS NOT NULL
  GROUP BY entity_key, PrintStore, day
  HAVING COUNT(*) >= :freq_min
)
"""
        predicates.append(
            """EXISTS (
      SELECT 1 FROM freq_groups f
      WHERE f.entity_key = b.entity_key
        AND f.PrintStore = b.PrintStore
        AND f.day = b.day
    )"""
        )

    always5_cte = ""
    if config.tier1_always_five_enabled:
        params["always_min"] = int(config.tier1_always_five_min_n)
        always5_cte = f"""
, always5_entities AS (
  SELECT entity_key
  FROM base
  WHERE entity_key IS NOT NULL
  GROUP BY entity_key
  HAVING COUNT(*) >= :always_min
     AND SUM(CASE WHEN Answer_Value = :top_box THEN 1 ELSE 0 END) = COUNT(*)
)
"""
        predicates.append(
            "b.entity_key IN (SELECT entity_key FROM always5_entities)"
        )

    if not predicates:
        cand_where = "1 = 0"
    else:
        cand_where = " OR ".join(predicates)

    sql = f"""
WITH base AS (
  SELECT
    {cols},
    {_SQLITE_ENTITY_KEY_EXPR} AS entity_key,
    date(AnswerTime) AS day
  FROM {ANSWERS_TABLE}
  {where}
)
{freq_cte}{always5_cte}
SELECT
    {cols}
FROM base b
WHERE {cand_where}
ORDER BY AnswerTime ASC
"""
    return sql, params


def _normalize_candidate_row(row: dict[str, Any]) -> dict[str, Any]:
    """Coerce SQLite/ODBC scalar types to SurveyAnswerRow expectations."""
    out = dict(row)
    pn = out.get("ParticipateNumber")
    if pn is not None and not isinstance(pn, str):
        out["ParticipateNumber"] = str(pn)
    av = out.get("Answer_Value")
    if isinstance(av, float) and av == int(av):
        out["Answer_Value"] = int(av)
    eid = out.get("ext_user_id")
    if isinstance(eid, float) and eid == int(eid):
        out["ext_user_id"] = int(eid)
    return out


def get_tier_candidate_rows(
    engine: Engine,
    period_start: date,
    period_end: date | None,
    config: PipelineConfig,
    store_ids: Sequence[int | float] | None = None,
    *,
    dialect: SqlDialect = "mssql",
) -> SampleResponse:
    """Query B candidates; hash PII before return (Inv. 1).

    Snapshot (sqlite) = phase 2 (blacklist ∪ freq ∪ always-5).
    VIEW (mssql) = v1 blacklist-only.
    """
    query = DbSampleQuery(from_date=period_start, to_date=period_end)
    mode = query_b_mode_for_dialect(dialect)
    sql, params = build_tier_candidate_sql(
        query, config, store_ids=store_ids, dialect=dialect
    )
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            raw_rows = [dict(mapping) for mapping in result.mappings()]
    except SQLAlchemyError as exc:
        logger.exception("Query B (tier candidate rows) failed")
        raise DbSampleError("Database query failed") from exc

    redacted = [_normalize_candidate_row(redact_row(r)) for r in raw_rows]
    rows = [SurveyAnswerRow.model_validate(r) for r in redacted]
    stores = {r.PrintStore for r in rows if r.PrintStore is not None}
    months = {
        (r.Year, r.Month) for r in rows if r.Year is not None and r.Month is not None
    }
    source_label = "snapshot" if dialect == "sqlite" else "view"
    if mode == "tier1_full":
        desc = (
            f"Query B phase 2 tier1 candidates ({source_label}: "
            "blacklist+freq+always5); PII hashed"
        )
    else:
        desc = f"Query B v1 blacklist candidates ({source_label}); PII hashed"
    return SampleResponse(
        preset="db_query_b",
        rows=rows,
        meta=SamplePresetMeta(
            preset="db_query_b",
            row_count=len(rows),
            store_count=len(stores),
            month_count=len(months),
            description=desc,
        ),
    )


def load_tier_candidates_from_settings(
    period_start: date = DEFAULT_FROM_DATE,
    period_end: date | None = None,
    config: PipelineConfig | None = None,
    store_ids: Sequence[int | float] | None = None,
) -> SampleResponse:
    """Query B via VIEW or snapshot engine from settings."""
    engine, dialect = _process_engine()
    return get_tier_candidate_rows(
        engine,
        period_start,
        period_end,
        config or PipelineConfig(),
        store_ids=store_ids,
        dialect=dialect,
    )


def process_source_meta_extra() -> dict[str, Any]:
    """Optional meta keys when ``SANITIZATION_SOURCE=snapshot``."""
    if get_sanitization_source() != "snapshot":
        return {"sanitization_source": "view"}
    try:
        from backend.snapshot import require_snapshot_engine

        engine = require_snapshot_engine()
        return meta_as_dict(read_meta(engine))
    except DbSampleError:
        return {"sanitization_source": "snapshot"}
