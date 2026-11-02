"""Local SQLite snapshot of AP avg_serve_time_minutes (TTS Planner).

Same idea as ``backend.snapshot`` for Q10012: refresh once from a host that
can reach AP, then Docker reads the file with no live SQL / DreamFactory.
Never commit ``data/*.sqlite``.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from planner.tts_kpi_ap import (
    DEFAULT_TABLE,
    KPI_NAME,
    STORE_ID_CAP,
    TtsKpiSourceError,
    qualify_table,
)

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TTS_KPI_SNAPSHOT_PATH = _PROJECT_ROOT / "data" / "tts_kpi_snapshot.sqlite"
DEFAULT_TTS_KPI_SNAPSHOT_URL = f"sqlite:///{DEFAULT_TTS_KPI_SNAPSHOT_PATH.as_posix()}"

KPI_ROWS_TABLE = "kpi_rows"
META_TABLE = "snapshot_meta"

_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {KPI_ROWS_TABLE} (
    StoreID_external INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    KPI_Score REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS {META_TABLE} (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_kpi_rows_store_ym
    ON {KPI_ROWS_TABLE} (StoreID_external, year, month);
"""


@dataclass(frozen=True)
class TtsKpiSnapshotMeta:
    loaded_at: str | None
    row_count: int
    source_table: str | None
    from_date: str | None


def resolve_tts_kpi_snapshot_url() -> str:
    raw = os.environ.get("TTS_KPI_SNAPSHOT_URL", "").strip()
    if raw:
        return raw
    return DEFAULT_TTS_KPI_SNAPSHOT_URL


def resolve_tts_kpi_snapshot_path() -> Path:
    url = resolve_tts_kpi_snapshot_url()
    prefix = "sqlite:///"
    if url.startswith(prefix):
        path = Path(url[len(prefix) :])
        if not path.is_absolute():
            path = _PROJECT_ROOT / path
        return path
    return DEFAULT_TTS_KPI_SNAPSHOT_PATH


def get_tts_kpi_snapshot_engine(*, create_schema: bool = False) -> Engine:
    url = resolve_tts_kpi_snapshot_url()
    if url.startswith("sqlite:///"):
        path = resolve_tts_kpi_snapshot_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{path.as_posix()}"
    engine = create_engine(url)
    if create_schema:
        init_tts_kpi_snapshot_schema(engine)
    return engine


def init_tts_kpi_snapshot_schema(engine: Engine) -> None:
    with engine.begin() as conn:
        for stmt in _SCHEMA_SQL.strip().split(";"):
            chunk = stmt.strip()
            if chunk:
                conn.execute(text(chunk))


def set_tts_kpi_meta(engine: Engine, values: dict[str, str]) -> None:
    with engine.begin() as conn:
        for key, value in values.items():
            conn.execute(
                text(
                    f"""
INSERT INTO {META_TABLE} (key, value) VALUES (:key, :value)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
"""
                ),
                {"key": key, "value": value},
            )


def read_tts_kpi_meta(engine: Engine) -> TtsKpiSnapshotMeta:
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(f"SELECT key, value FROM {META_TABLE}")).all()
    except SQLAlchemyError:
        return TtsKpiSnapshotMeta(
            loaded_at=None,
            row_count=0,
            source_table=None,
            from_date=None,
        )
    kv = {str(k): str(v) for k, v in rows}

    def _int(key: str) -> int:
        try:
            return int(kv.get(key, "0") or 0)
        except ValueError:
            return 0

    return TtsKpiSnapshotMeta(
        loaded_at=kv.get("loaded_at"),
        row_count=_int("row_count"),
        source_table=kv.get("source_table"),
        from_date=kv.get("from_date"),
    )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_tts_kpi_snapshot_engine() -> Engine:
    """Fail fast when the snapshot file is missing (Docker without refresh)."""
    path = resolve_tts_kpi_snapshot_path()
    url = resolve_tts_kpi_snapshot_url()
    if url.startswith("sqlite:///") and not path.is_file():
        raise TtsKpiSourceError(
            f"TTS KPI snapshot not found at {path}. "
            "Run: uv run python scripts/refresh_tts_kpi_snapshot.py",
            status_code=503,
        )
    try:
        engine = get_tts_kpi_snapshot_engine(create_schema=False)
        with engine.connect() as conn:
            conn.execute(text(f"SELECT 1 FROM {KPI_ROWS_TABLE} LIMIT 1"))
        return engine
    except TtsKpiSourceError:
        raise
    except Exception as exc:
        logger.exception("tts kpi snapshot engine setup failed")
        raise TtsKpiSourceError(
            "TTS KPI snapshot is not available. "
            "Run: uv run python scripts/refresh_tts_kpi_snapshot.py",
            status_code=503,
        ) from exc


def fetch_tts_kpi_snapshot_rows(engine: Engine) -> list[dict[str, object]]:
    """Read the four AP columns from the local snapshot (no KPI filter — already filtered)."""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                f"""
SELECT StoreID_external, year, month, KPI_Score
FROM {KPI_ROWS_TABLE}
"""
            )
        )
        return [dict(row) for row in result.mappings()]


_BATCH = 5_000


def _pull_sql(table: str, *, with_to: bool) -> str:
    qualified = qualify_table(table)
    to_clause = ""
    if with_to:
        to_clause = """
  AND (
    year < :to_year
    OR (year = :to_year AND month <= :to_month)
  )"""
    return f"""
SELECT StoreID_external, year, month, KPI_Score
FROM {qualified}
WHERE KPI = :kpi
  AND StoreID_external < :store_cap
  AND (
    year > :from_year
    OR (year = :from_year AND month >= :from_month)
  ){to_clause}
ORDER BY year ASC, month ASC, StoreID_external ASC
"""


def refresh_tts_kpi_snapshot(
    *,
    from_date: date,
    out_path: Path,
    to_date: date | None = None,
) -> dict[str, object]:
    """Pull AP → SQLite full reload. Requires ``TTS_KPI_DATABASE_URL``."""
    url = os.environ.get("TTS_KPI_DATABASE_URL", "").strip()
    if not url:
        raise TtsKpiSourceError(
            "TTS_KPI_DATABASE_URL is not set.",
            status_code=503,
        )
    table = os.environ.get("TTS_KPI_TABLE", "").strip() or DEFAULT_TABLE

    out_path.parent.mkdir(parents=True, exist_ok=True)
    os.environ["TTS_KPI_SNAPSHOT_URL"] = f"sqlite:///{out_path.resolve().as_posix()}"

    t0 = time.perf_counter()
    src = create_engine(url)
    snap = get_tts_kpi_snapshot_engine(create_schema=True)
    init_tts_kpi_snapshot_schema(snap)
    loaded_at = utc_now_iso()

    sql = text(_pull_sql(table, with_to=to_date is not None))
    params: dict[str, object] = {
        "kpi": KPI_NAME,
        "store_cap": STORE_ID_CAP,
        "from_year": from_date.year,
        "from_month": from_date.month,
    }
    if to_date is not None:
        params["to_year"] = to_date.year
        params["to_month"] = to_date.month
    range_label = f"{from_date.year}-{from_date.month:02d}"
    if to_date is not None:
        range_label += f" … {to_date.year}-{to_date.month:02d}"
    logger.info("Pulling %s from %s (%s)…", KPI_NAME, table, range_label)

    insert_sql = text(
        f"""
INSERT INTO {KPI_ROWS_TABLE} (
    StoreID_external, year, month, KPI_Score
) VALUES (
    :StoreID_external, :year, :month, :KPI_Score
)
"""
    )

    row_count = 0
    try:
        with src.connect() as src_conn, snap.begin() as dst:
            dst.execute(text(f"DELETE FROM {KPI_ROWS_TABLE}"))
            result = src_conn.execute(sql, params)
            batch: list[dict[str, object]] = []
            for mapping in result.mappings():
                row = dict(mapping)
                batch.append(
                    {
                        "StoreID_external": row.get("StoreID_external"),
                        "year": row.get("year"),
                        "month": row.get("month"),
                        "KPI_Score": row.get("KPI_Score"),
                    }
                )
                if len(batch) >= _BATCH:
                    dst.execute(insert_sql, batch)
                    row_count += len(batch)
                    logger.info("  …inserted %s rows", row_count)
                    batch = []
            if batch:
                dst.execute(insert_sql, batch)
                row_count += len(batch)
    except SQLAlchemyError as exc:
        raise TtsKpiSourceError(
            "Could not read TTS minutes from AP for the snapshot refresh.",
            status_code=503,
        ) from exc
    finally:
        src.dispose()

    meta = {
        "loaded_at": loaded_at,
        "row_count": str(row_count),
        "source_table": table,
        "from_date": from_date.isoformat(),
    }
    if to_date is not None:
        meta["to_date"] = to_date.isoformat()
    set_tts_kpi_meta(snap, meta)

    elapsed = round(time.perf_counter() - t0, 2)
    summary: dict[str, object] = {
        "path": str(out_path.resolve()),
        "row_count": row_count,
        "loaded_at": loaded_at,
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat() if to_date else None,
        "source_table": table,
        "elapsed_s": elapsed,
    }
    logger.info(
        "TTS KPI snapshot ready: %s rows → %s (%.1fs)",
        row_count,
        out_path,
        elapsed,
    )
    return summary
