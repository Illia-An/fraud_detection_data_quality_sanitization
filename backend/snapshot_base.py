"""Shared SQLite snapshot helpers (Wave 8 / M-07).

Used by Q10012 ``backend.snapshot`` and TTS KPI ``backend.tts_kpi_snapshot``.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import Engine, text

from backend.data_access import get_cached_engine

_PROJECT_ROOT = Path(__file__).resolve().parents[1]


def project_root() -> Path:
    return _PROJECT_ROOT


def resolve_sqlite_file_url(
    env_url: str,
    *,
    default_path: Path,
) -> str:
    """Return a ``sqlite:///`` URL from env override or default path."""
    raw = (env_url or "").strip()
    if raw:
        return raw
    return f"sqlite:///{default_path.as_posix()}"


def resolve_sqlite_path_from_url(url: str, *, default_path: Path) -> Path:
    """Filesystem path for file-backed ``sqlite:///`` URLs."""
    prefix = "sqlite:///"
    if url.startswith(prefix):
        rest = url[len(prefix) :]
        path = Path(rest)
        if not path.is_absolute():
            path = _PROJECT_ROOT / path
        return path
    return default_path


def ensure_sqlite_url_with_path(url: str, path: Path) -> str:
    """Normalize file-backed sqlite URLs to an absolute path form."""
    if url.startswith("sqlite:///"):
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{path.as_posix()}"
    return url


def get_sqlite_engine(url: str, *, schema_sql: str | None = None) -> Engine:
    """Cached engine; optionally run idempotent schema DDL."""
    engine = get_cached_engine(url)
    if schema_sql:
        init_sqlite_schema(engine, schema_sql)
    return engine


def init_sqlite_schema(engine: Engine, schema_sql: str) -> None:
    """Execute semicolon-separated DDL (idempotent CREATE IF NOT EXISTS)."""
    with engine.begin() as conn:
        for stmt in schema_sql.strip().split(";"):
            chunk = stmt.strip()
            if chunk:
                conn.execute(text(chunk))
