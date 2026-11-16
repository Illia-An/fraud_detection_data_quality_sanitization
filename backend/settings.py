"""Typed application settings (Wave 7 / A-05).

Centralizes the env knobs read by the HTTP app. Domain-specific readers
(snapshot gates, TTS KPI, etc.) may still use ``os.environ``; migrate those
when their modules are touched.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

from backend.version import app_version, package_version

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_CORS = "http://localhost:5173,http://localhost:4201"


def _truthy(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _falsy(raw: str) -> bool:
    return raw.strip().lower() in ("0", "false", "no", "off")


def _running_in_docker() -> bool:
    if _truthy(os.environ.get("RUNNING_IN_DOCKER", "")):
        return True
    return Path("/.dockerenv").exists()


def _parse_cors(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _docs_enabled() -> bool:
    raw = os.environ.get("ENABLE_DOCS", "").strip()
    if raw and _truthy(raw):
        return True
    if raw and _falsy(raw):
        return False
    return not _running_in_docker()


@dataclass(frozen=True)
class AppSettings:
    """HTTP / process-facing settings (immutable snapshot)."""

    app_version: str
    package_version: str
    cors_origins: list[str]
    enable_docs: bool
    sanitization_source: str
    tts_kpi_source: str
    api_key: str | None
    database_url: str
    snapshot_url: str
    db_connect_timeout_s: int
    db_pool_recycle_s: int


@lru_cache
def get_app_settings() -> AppSettings:
    load_dotenv(_PROJECT_ROOT / ".env")
    api_key = os.environ.get("API_KEY", "").strip() or None
    timeout_raw = os.environ.get("DB_CONNECT_TIMEOUT_S", "30").strip()
    recycle_raw = os.environ.get("DB_POOL_RECYCLE_S", "1800").strip()
    try:
        connect_timeout = max(1, int(timeout_raw))
    except ValueError:
        connect_timeout = 30
    try:
        pool_recycle = max(60, int(recycle_raw))
    except ValueError:
        pool_recycle = 1800
    source = os.environ.get("SANITIZATION_SOURCE", "snapshot").strip().lower() or "snapshot"
    if source in ("sqlite",):
        source = "snapshot"
    tts_src = os.environ.get("TTS_KPI_SOURCE", "synthetic").strip().lower() or "synthetic"
    return AppSettings(
        app_version=app_version(),
        package_version=package_version(),
        cors_origins=_parse_cors(
            os.environ.get("API_CORS_ORIGINS", _DEFAULT_CORS)
        ),
        enable_docs=_docs_enabled(),
        sanitization_source=source if source in ("view", "snapshot") else "snapshot",
        tts_kpi_source=tts_src,
        api_key=api_key,
        database_url=os.environ.get("DATABASE_URL", "").strip(),
        snapshot_url=os.environ.get("SNAPSHOT_URL", "").strip(),
        db_connect_timeout_s=connect_timeout,
        db_pool_recycle_s=pool_recycle,
    )


def clear_app_settings_cache() -> None:
    get_app_settings.cache_clear()
