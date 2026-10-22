"""Read monthly TTS minutes from AP. Never writes. Never uses another KPI.

``TTS_KPI_SOURCE`` selects the transport:

- ``synthetic`` (default) — this loader stays off; the planner uses small|medium|stress
- ``sql`` — one SELECT through ``TTS_KPI_DATABASE_URL`` (ODBC / SQLAlchemy)
- ``dreamfactory`` — the same filter through ``TTS_KPI_API_URL``

The API key and the database URL are not logged and are not copied into errors.
"""

from __future__ import annotations

import os

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from planner.tts_kpi_ap import (
    DEFAULT_TABLE,
    KPI_NAME,
    STORE_ID_CAP,
    ApTtsKpiPanel,
    TtsKpiSourceError,
    dreamfactory_query,
    rows_to_panel,
    tts_kpi_select_sql,
)

_API_KEY_HEADER = "X-DreamFactory-Api-Key"


def tts_kpi_source() -> str:
    """``synthetic``, ``sql``, or ``dreamfactory``. Anything else is rejected at load."""
    return os.environ.get("TTS_KPI_SOURCE", "synthetic").strip().lower() or "synthetic"


def load_ap_tts_kpi_panel() -> ApTtsKpiPanel:
    """Load the AP panel for the configured source. Synthetic is not a silent substitute."""
    source = tts_kpi_source()
    if source in ("synthetic", "sample"):
        raise TtsKpiSourceError(
            "TTS KPI source is synthetic. Set TTS_KPI_SOURCE=sql or TTS_KPI_SOURCE=dreamfactory.",
            status_code=503,
        )
    if source == "sql":
        raw_rows = _fetch_sql()
    elif source == "dreamfactory":
        raw_rows = _fetch_dreamfactory()
    else:
        raise TtsKpiSourceError(
            "TTS_KPI_SOURCE must be synthetic, sql, or dreamfactory.",
            status_code=503,
        )
    return rows_to_panel(raw_rows)


def _fetch_sql() -> list[dict[str, object]]:
    url = os.environ.get("TTS_KPI_DATABASE_URL", "").strip()
    if not url:
        raise TtsKpiSourceError(
            "TTS_KPI_DATABASE_URL is not set.",
            status_code=503,
        )
    table = os.environ.get("TTS_KPI_TABLE", "").strip() or DEFAULT_TABLE
    statement = text(tts_kpi_select_sql(table))
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            result = conn.execute(
                statement,
                {"kpi": KPI_NAME, "store_cap": STORE_ID_CAP},
            )
            return [dict(row) for row in result.mappings()]
    except SQLAlchemyError:
        raise TtsKpiSourceError(
            "Could not read TTS minutes from AP.",
            status_code=503,
        ) from None
    finally:
        engine.dispose()


def _fetch_dreamfactory() -> list[dict[str, object]]:
    url = os.environ.get("TTS_KPI_API_URL", "").strip()
    if not url:
        raise TtsKpiSourceError(
            "TTS_KPI_API_URL is not set.",
            status_code=503,
        )
    api_key = os.environ.get("TTS_KPI_API_KEY", "").strip()
    headers = {"Accept": "application/json"}
    if api_key:
        headers[_API_KEY_HEADER] = api_key
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, params=dreamfactory_query(), headers=headers)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        raise TtsKpiSourceError(
            "Could not read TTS minutes from the DreamFactory API.",
            status_code=503,
        ) from None
    return _resource_rows(payload)


def _resource_rows(payload: object) -> list[dict[str, object]]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        resource = payload.get("resource", payload.get("record"))
        rows = resource if isinstance(resource, list) else []
    else:
        rows = []
    parsed: list[dict[str, object]] = []
    for row in rows:
        if isinstance(row, dict):
            parsed.append(row)
    return parsed
