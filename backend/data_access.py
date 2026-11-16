"""Public data-access seam (Wave 7 / A-08, M-08, A-03).

Callers (queries, scripts, routers) import from here — not private
``backend.db_sample._*`` helpers. Engines are cached per URL and disposed
on app shutdown; VIEW (MSSQL) gets connect timeout + pool recycle.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url

from backend.db_sample import (
    DEFAULT_FROM_DATE,
    QUESTION_ID,
    VIEW_NAME,
    DbSampleError,
    DbSampleQuery,
    ProcessSource,
    SqlDialect,
    build_meta_sql,
    build_sql,
    engine_from_settings,
    period_params,
    process_engine,
    resolve_process_source,
)
from backend.settings import get_app_settings

logger = logging.getLogger(__name__)

__all__ = [
    "DEFAULT_FROM_DATE",
    "QUESTION_ID",
    "VIEW_NAME",
    "DbSampleError",
    "DbSampleQuery",
    "ProcessSource",
    "SqlDialect",
    "build_meta_sql",
    "build_sql",
    "dispose_engines",
    "engine_from_settings",
    "get_cached_engine",
    "period_params",
    "process_engine",
    "resolve_process_source",
]

_LOCK = threading.Lock()
_ENGINE_CACHE: dict[str, Engine] = {}


def get_cached_engine(
    url: str,
    *,
    connect_timeout_s: int | None = None,
    pool_recycle_s: int | None = None,
) -> Engine:
    """One SQLAlchemy engine per URL for the process lifetime."""
    key = url.strip()
    if not key:
        raise ValueError("database URL is empty")
    with _LOCK:
        cached = _ENGINE_CACHE.get(key)
        if cached is not None:
            return cached
        settings = get_app_settings()
        timeout = (
            connect_timeout_s
            if connect_timeout_s is not None
            else settings.db_connect_timeout_s
        )
        recycle = (
            pool_recycle_s
            if pool_recycle_s is not None
            else settings.db_pool_recycle_s
        )
        kwargs: dict[str, Any] = {"pool_pre_ping": True, "pool_recycle": recycle}
        backend = make_url(key).get_backend_name()
        if backend != "sqlite":
            # pyodbc login timeout (seconds); holds a worker if VIEW is slow.
            kwargs["connect_args"] = {"timeout": timeout}
        engine = create_engine(key, **kwargs)
        _ENGINE_CACHE[key] = engine
        return engine


def dispose_engines() -> None:
    """Dispose all cached engines (app lifespan shutdown)."""
    with _LOCK:
        engines = list(_ENGINE_CACHE.values())
        _ENGINE_CACHE.clear()
    for engine in engines:
        try:
            engine.dispose()
        except Exception:
            logger.exception("engine dispose failed")
