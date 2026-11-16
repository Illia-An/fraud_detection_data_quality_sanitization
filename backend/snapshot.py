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

from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from backend.db_sample import DbSampleError

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT_PATH = _PROJECT_ROOT / "data" / "q10012_snapshot.sqlite"
DEFAULT_SNAPSHOT_URL = f"sqlite:///{DEFAULT_SNAPSHOT_PATH.as_posix()}"

ANSWERS_TABLE = "answers"
STORE_MONTH_TABLE = "store_month"
META_TABLE = "snapshot_meta"

# Bump when answers / store_month / meta contract changes (Wave 2 / D-05).
SCHEMA_VERSION = "1"

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
    schema_version: str | None = None
    # Wave 6 / S-04: "1" when UserContact/PhoneFromLog were hashed before write.
    pii_hashed_at_rest: bool = False


def running_in_docker() -> bool:
    """Best-effort Docker detection for G-1 / Wave 1.4 warnings."""
    if os.environ.get("RUNNING_IN_DOCKER", "").strip() in ("1", "true", "yes"):
        return True
    return Path("/.dockerenv").exists()


def get_sanitization_source() -> SanitizationSource:
    """Resolve ``SANITIZATION_SOURCE`` (default ``snapshot`` per G-1)."""
    raw = os.environ.get("SANITIZATION_SOURCE", "snapshot").strip().lower()
    if raw in ("snapshot", "sqlite"):
        return "snapshot"
    return "view"


def view_source_dev_warning() -> str | None:
    """Warn when VIEW is used outside Docker (dev-only per G-1)."""
    if get_sanitization_source() != "view":
        return None
    if running_in_docker():
        return (
            "SANITIZATION_SOURCE=view inside Docker; production policy (G-1) is "
            "snapshot-only"
        )
    return (
        "SANITIZATION_SOURCE=view (dev only per G-1); production uses snapshot. "
        "Tiers 2–3 are not applied on VIEW."
    )


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


def get_snapshot_engine_at(path: Path, *, create_schema: bool = False) -> Engine:
    """Engine for an explicit SQLite file path (refresh tmp / tests)."""
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
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


def set_meta_conn(conn: Connection, values: dict[str, str]) -> None:
    """Upsert ``snapshot_meta`` on an open connection/transaction."""
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


def set_meta(engine: Engine, values: dict[str, str]) -> None:
    """Upsert key/value rows in ``snapshot_meta``."""
    with engine.begin() as conn:
        set_meta_conn(conn, values)


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
            schema_version=None,
            pii_hashed_at_rest=False,
        )
    kv = {str(k): str(v) for k, v in rows}

    def _int(key: str) -> int:
        try:
            return int(kv.get(key, "0") or 0)
        except ValueError:
            return 0

    pii_flag = (kv.get("pii_hashed_at_rest") or "").strip().lower()
    return SnapshotMeta(
        loaded_at=kv.get("loaded_at"),
        row_count=_int("row_count"),
        store_month_count=_int("store_month_count"),
        source_view=kv.get("source_view"),
        from_date=kv.get("from_date"),
        schema_version=kv.get("schema_version"),
        pii_hashed_at_rest=pii_flag in ("1", "true", "yes"),
    )


def meta_as_dict(meta: SnapshotMeta) -> dict[str, Any]:
    """JSON-friendly meta fragment for API responses."""
    return {
        "sanitization_source": "snapshot",
        "snapshot_loaded_at": meta.loaded_at,
        "snapshot_row_count": meta.row_count,
        "snapshot_store_month_count": meta.store_month_count,
        "snapshot_from_date": meta.from_date,
        "snapshot_schema_version": meta.schema_version,
        "snapshot_pii_hashed_at_rest": meta.pii_hashed_at_rest,
    }


def assert_snapshot_schema_version(meta: SnapshotMeta) -> None:
    """Raise 503 when meta schema_version is missing or mismatched (D-05)."""
    if meta.schema_version != SCHEMA_VERSION:
        raise DbSampleError(
            "Snapshot schema_version mismatch "
            f"(found={meta.schema_version!r}, expected={SCHEMA_VERSION!r}). "
            "Run: uv run python scripts/refresh_q10012_snapshot.py",
            status_code=503,
        )


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
        meta = read_meta(engine)
        assert_snapshot_schema_version(meta)
        if meta.row_count <= 0:
            # Fail closed on empty / stale meta even if a row happens to exist.
            with engine.connect() as conn:
                n = int(
                    conn.execute(text(f"SELECT COUNT(*) FROM {ANSWERS_TABLE}")).scalar()
                    or 0
                )
            if n <= 0:
                raise DbSampleError(
                    f"Snapshot at {path} has no answer rows. "
                    "Run: uv run python scripts/refresh_q10012_snapshot.py",
                    status_code=503,
                )
        return engine
    except DbSampleError:
        raise
    except Exception as exc:
        logger.exception("snapshot engine setup failed")
        raise DbSampleError(
            "Snapshot database is not available. "
            "Run: uv run python scripts/refresh_q10012_snapshot.py"
        ) from exc
