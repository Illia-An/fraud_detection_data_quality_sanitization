"""Read-only DB sample loader for the sanitization PoC.

Pulls Q10012 rows from ``dbo.TargetsByMetrics_RateGetAnswers`` for the
period ``AnswerTime >= 2026-01-01`` (through latest). Optional store /
year / month filters narrow that window. Entity PII is hashed so Tier 1
entity keys still work; name columns are never selected.

GET ``/sample/db`` returns metadata only (no row payload). POST
``/process`` with ``source=db`` loads the period on the server and runs
the pipeline — rows never round-trip through the browser.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from backend.schemas import SamplePresetMeta, SampleResponse, SurveyAnswerRow
from fraud_guard.pii import hash_pii_value

logger = logging.getLogger(__name__)

VIEW_NAME = "dbo.TargetsByMetrics_RateGetAnswers"
QUESTION_ID = 10012
DEFAULT_FROM_DATE = date(2026, 1, 1)

# Columns needed by Tier 1/2 + UI — never SELECT *.
_SELECT_COLUMNS = (
    "ParticipateNumber",
    "Question_ID",
    "Answer_Value",
    "BlackList",
    "UserContact",
    "PhoneFromLog",
    "ext_user_id",
    "PrintStore",
    "AnswerTime",
    "PrintDateTime",
    "Year",
    "Month",
    "ContactType",
)

# Stable hashes so entity grouping survives client → POST /process.
_HASH_PII_COLUMNS = ("UserContact", "PhoneFromLog")


@dataclass(frozen=True)
class DbSampleQuery:
    """Filters for a read-only period pull."""

    store: int | float | None = None
    year: int | None = None
    month: int | None = None
    from_date: date = DEFAULT_FROM_DATE


class DbSampleError(Exception):
    """Raised when the DB sample cannot be loaded (config / connectivity)."""

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


def redact_row(row: dict[str, Any]) -> dict[str, Any]:
    """Hash entity PII fields; leave other selected columns unchanged."""
    out = dict(row)
    for col in _HASH_PII_COLUMNS:
        if col in out:
            out[col] = hash_pii_value(out[col])
    return out


def _period_params(query: DbSampleQuery) -> tuple[str, dict[str, Any]]:
    where = """
WHERE Question_ID = :question_id
  AND AnswerTime >= :from_date
"""
    params: dict[str, Any] = {
        "question_id": QUESTION_ID,
        "from_date": datetime.combine(query.from_date, datetime.min.time()),
    }
    if query.store is not None:
        where += "  AND PrintStore = :store\n"
        params["store"] = query.store
    if query.year is not None:
        where += "  AND [Year] = :year\n"
        params["year"] = query.year
    if query.month is not None:
        where += "  AND [Month] = :month\n"
        params["month"] = query.month
    return where, params


def _filter_labels(query: DbSampleQuery) -> list[str]:
    filters: list[str] = [f"AnswerTime>={query.from_date.isoformat()}"]
    if query.store is not None:
        filters.append(f"store={query.store}")
    if query.year is not None:
        filters.append(f"year={query.year}")
    if query.month is not None:
        filters.append(f"month={query.month}")
    return filters


def _meta_description(query: DbSampleQuery) -> str:
    return "SQL Server RateGetAnswers (Q10012, PII hashed); " + ", ".join(_filter_labels(query))


def _build_sql(query: DbSampleQuery) -> tuple[str, dict[str, Any]]:
    cols = ", ".join(_SELECT_COLUMNS)
    where, params = _period_params(query)
    sql = f"""
SELECT
    {cols}
FROM {VIEW_NAME}
{where}ORDER BY AnswerTime ASC
"""
    return sql, params


def _build_meta_sql(query: DbSampleQuery) -> tuple[str, dict[str, Any]]:
    where, params = _period_params(query)
    sql = f"""
SELECT
    COUNT(*) AS row_count,
    COUNT(DISTINCT PrintStore) AS store_count,
    COUNT(DISTINCT ([Year] * 100 + [Month])) AS month_count
FROM {VIEW_NAME}
{where}
"""
    return sql, params


def _sample_meta(
    query: DbSampleQuery, *, row_count: int, store_count: int, month_count: int
) -> SamplePresetMeta:
    return SamplePresetMeta(
        preset="db",
        row_count=int(row_count),
        store_count=int(store_count),
        month_count=int(month_count),
        description=_meta_description(query),
    )


def fetch_db_sample_meta(engine: Engine, query: DbSampleQuery | None = None) -> SampleResponse:
    """Period counts only — no survey rows in the payload."""
    q = query or DbSampleQuery()
    sql, params = _build_meta_sql(q)
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            mapping = result.mappings().first() or {}
    except SQLAlchemyError as exc:
        logger.exception("db sample meta query failed")
        raise DbSampleError("Database query failed") from exc

    return SampleResponse(
        preset="db",
        rows=[],
        meta=_sample_meta(
            q,
            row_count=mapping.get("row_count") or 0,
            store_count=mapping.get("store_count") or 0,
            month_count=mapping.get("month_count") or 0,
        ),
    )


def fetch_db_sample(engine: Engine, query: DbSampleQuery | None = None) -> SampleResponse:
    """Execute a parameterized SELECT and return a ``SampleResponse`` with rows."""
    q = query or DbSampleQuery()
    sql, params = _build_sql(q)

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            raw_rows = [dict(mapping) for mapping in result.mappings()]
    except SQLAlchemyError as exc:
        logger.exception("db sample query failed")
        raise DbSampleError("Database query failed") from exc

    redacted = [redact_row(r) for r in raw_rows]
    rows = [SurveyAnswerRow.model_validate(r) for r in redacted]
    stores = {r.PrintStore for r in rows if r.PrintStore is not None}
    months = {(r.Year, r.Month) for r in rows if r.Year is not None and r.Month is not None}

    return SampleResponse(
        preset="db",
        rows=rows,
        meta=_sample_meta(
            q,
            row_count=len(rows),
            store_count=len(stores),
            month_count=len(months),
        ),
    )


def _engine_from_settings() -> Engine:
    try:
        from db.connection import get_engine
        from db.config import get_settings

        get_settings()  # fail fast if DATABASE_URL missing
        return get_engine()
    except ValueError as exc:
        raise DbSampleError(str(exc) or "DATABASE_URL is not configured") from exc
    except Exception as exc:
        logger.exception("db engine setup failed")
        raise DbSampleError("Database is not available") from exc


def load_db_sample_meta_from_settings(query: DbSampleQuery | None = None) -> SampleResponse:
    """Create engine from ``.env`` and fetch period metadata."""
    return fetch_db_sample_meta(_engine_from_settings(), query)


def load_db_sample_from_settings(query: DbSampleQuery | None = None) -> SampleResponse:
    """Create engine from ``.env`` and fetch the full period. Raises ``DbSampleError``."""
    return fetch_db_sample(_engine_from_settings(), query)
