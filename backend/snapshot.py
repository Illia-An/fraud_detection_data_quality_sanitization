"""Local SQLite daily snapshot for Q10012 (SPEC Section 5.4).

Interim fast path while DBA prepares physical SQL Server tables.
PII may be stored locally in the snapshot file — never commit ``*.sqlite``.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from backend.db_sample import DbSampleError

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT_PATH = _PROJECT_ROOT / "data" / "q10012_snapshot.sqlite"
DEFAULT_SNAPSHOT_URL = f"sqlite:///{DEFAULT_SNAPSHOT_PATH.as_posix()}"

ANSWERS_TABLE = "answers"
STORE_MONTH_TABLE = "store_month"
META_TABLE = "snapshot_meta"

SanitizationSource = Literal["view", "snapshot"]

_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {ANSWERS_TABLE} (
    ParticipateNumber TEXT,
    Question_ID INTEGER NOT NULL,
    Answer_Value INTEGER,
    BlackList TEXT,
    UserContact TEXT,
    PhoneFromLog TEXT,
    ext_user_id REAL,
    PrintStore REAL,
    AnswerTime TEXT,
    Year INTEGER,
    Month INTEGER,
    LoadedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS {STORE_MONTH_TABLE} (
    PrintStore REAL NOT NULL,
    Year INTEGER NOT NULL,
    Month INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    top_box_count INTEGER NOT NULL,
    PRIMARY KEY (PrintStore, Year, Month)
);

CREATE TABLE IF NOT EXISTS {META_TABLE} (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_answers_answer_time
    ON {ANSWERS_TABLE} (AnswerTime);
CREATE INDEX IF NOT EXISTS ix_answers_blacklist_time
    ON {ANSWERS_TABLE} (BlackList, AnswerTime);
CREATE INDEX IF NOT EXISTS ix_answers_store_ym
    ON {ANSWERS_TABLE} (PrintStore, Year, Month);
"""


@dataclass(frozen=True)
class SnapshotMeta:
    """Freshness / cardinality written by the refresh job."""

    loaded_at: str | None
    row_count: int
    store_month_count: int
    source_view: str | None
    from_date: str | None


def get_sanitization_source() -> SanitizationSource:
    """Resolve ``SANITIZATION_SOURCE`` (default ``view``)."""
    raw = os.environ.get("SANITIZATION_SOURCE", "view").strip().lower()
    if raw in ("snapshot", "sqlite"):
        return "snapshot"
    return "view"


def resolve_snapshot_url() -> str:
    """``SNAPSHOT_URL`` or default file under ``data/``."""
    raw = os.environ.get("SNAPSHOT_URL", "").strip()
    if raw:
        return raw
    return DEFAULT_SNAPSHOT_URL


def resolve_snapshot_path() -> Path:
    """Filesystem path for file-backed ``sqlite:///`` URLs; else default path."""
    url = resolve_snapshot_url()
    prefix = "sqlite:///"
    if url.startswith(prefix):
        rest = url[len(prefix) :]
        # sqlalchemy allows sqlite:////abs and sqlite:///rel
        path = Path(rest)
        if not path.is_absolute():
            path = _PROJECT_ROOT / path
        return path
    return DEFAULT_SNAPSHOT_PATH


def get_snapshot_engine(*, create_schema: bool = False) -> Engine:
    """SQLAlchemy engine for the local snapshot DB."""
    url = resolve_snapshot_url()
    if url.startswith("sqlite:///"):
        path = resolve_snapshot_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{path.as_posix()}"
    engine = create_engine(url)
    if create_schema:
        init_snapshot_schema(engine)
    return engine


def init_snapshot_schema(engine: Engine) -> None:
    """Create tables/indexes if missing (idempotent)."""
    with engine.begin() as conn:
        for stmt in _SCHEMA_SQL.strip().split(";"):
            chunk = stmt.strip()
            if chunk:
                conn.execute(text(chunk))


def set_meta(engine: Engine, values: dict[str, str]) -> None:
    """Upsert key/value rows in ``snapshot_meta``."""
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


def read_meta(engine: Engine) -> SnapshotMeta:
    """Load snapshot freshness metadata (empty defaults if missing)."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(f"SELECT key, value FROM {META_TABLE}")).all()
    except SQLAlchemyError:
        return SnapshotMeta(
            loaded_at=None,
            row_count=0,
            store_month_count=0,
            source_view=None,
            from_date=None,
        )
    kv = {str(k): str(v) for k, v in rows}

    def _int(key: str) -> int:
        try:
            return int(kv.get(key, "0") or 0)
        except ValueError:
            return 0

    return SnapshotMeta(
        loaded_at=kv.get("loaded_at"),
        row_count=_int("row_count"),
        store_month_count=_int("store_month_count"),
        source_view=kv.get("source_view"),
        from_date=kv.get("from_date"),
    )


def meta_as_dict(meta: SnapshotMeta) -> dict[str, Any]:
    """JSON-friendly meta fragment for API responses."""
    return {
        "sanitization_source": "snapshot",
        "snapshot_loaded_at": meta.loaded_at,
        "snapshot_row_count": meta.row_count,
        "snapshot_store_month_count": meta.store_month_count,
        "snapshot_from_date": meta.from_date,
    }


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def require_snapshot_engine() -> Engine:
    """Engine for process path; fail if snapshot file is missing / unreadable."""
    path = resolve_snapshot_path()
    url = resolve_snapshot_url()
    if url.startswith("sqlite:///") and not path.is_file():
        raise DbSampleError(
            f"Snapshot not found at {path}. "
            "Run: uv run python scripts/refresh_q10012_snapshot.py",
            status_code=503,
        )
    try:
        engine = get_snapshot_engine(create_schema=False)
        # Touch meta / answers to fail fast on empty/corrupt DB.
        with engine.connect() as conn:
            conn.execute(text(f"SELECT 1 FROM {ANSWERS_TABLE} LIMIT 1"))
        return engine
    except DbSampleError:
        raise
    except Exception as exc:
        logger.exception("snapshot engine setup failed")
        raise DbSampleError(
            "Snapshot database is not available. "
            "Run: uv run python scripts/refresh_q10012_snapshot.py"
        ) from exc
