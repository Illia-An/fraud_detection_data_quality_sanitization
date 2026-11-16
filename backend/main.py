"""FastAPI entry point for sanitization PoC."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.auth import ApiKeyMiddleware, auth_enabled
from backend.data_access import dispose_engines
from backend.observability import (
    RequestIdMiddleware,
    app_version,
    configure_logging,
    log_event,
    log_shutdown,
    log_startup,
)
from backend.readiness import evaluate_readiness, snapshot_max_age_days
from backend.request_limits import BodySizeLimitMiddleware
from backend.routers import include_routers
from backend.settings import clear_app_settings_cache, get_app_settings
from backend.snapshot import SCHEMA_VERSION, get_sanitization_source, view_source_dev_warning
from backend.static_ui import mount_frontend

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")

logger = logging.getLogger(__name__)

# Re-export for tests / callers that historically imported from main.
API_PREFIX = "/api/v1"


def _startup_log_fields() -> dict:
    """Safe startup diagnostics (no paths, credentials, or env dumps)."""
    ready = evaluate_readiness()
    settings = get_app_settings()
    from fraud_guard.pii import pii_hmac_key

    return {
        "sanitization_source": get_sanitization_source(),
        "tts_kpi_source": settings.tts_kpi_source,
        "schema_version_expected": SCHEMA_VERSION,
        "snapshot_present": ready.snapshot_present,
        "snapshot_schema_version": ready.schema_version,
        "snapshot_row_count": ready.snapshot_row_count,
        "snapshot_loaded_at": ready.snapshot_loaded_at,
        "snapshot_age_s": ready.snapshot_age_s,
        "snapshot_max_age_days": snapshot_max_age_days(),
        "ready": ready.ok,
        "ready_reasons": ready.reasons,
        "auth_enabled": auth_enabled(),
        "docs_enabled": settings.enable_docs,
        "pii_hmac_configured": pii_hmac_key() is not None,
    }


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    warning = view_source_dev_warning()
    if warning:
        log_event("source_warning", level=logging.WARNING, message=warning)
    log_startup(sources=_startup_log_fields())
    try:
        yield
    finally:
        dispose_engines()
        log_shutdown()


def create_app() -> FastAPI:
    configure_logging()
    # Re-read env each factory call (tests monkeypatch ENABLE_DOCS / CORS).
    clear_app_settings_cache()
    settings = get_app_settings()
    docs_on = settings.enable_docs
    app = FastAPI(
        title="Fraud Guard Sanitization PoC",
        version=app_version(),
        description="Tier 1/2 survey sanitization pipeline",
        lifespan=_lifespan,
        docs_url="/docs" if docs_on else None,
        redoc_url="/redoc" if docs_on else None,
        openapi_url="/openapi.json" if docs_on else None,
    )

    # Outer middleware runs first for incoming requests
    # (body size → auth → request id → CORS).
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(ApiKeyMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, exc: RequestValidationError) -> JSONResponse:
        # Wave 6 / S-10: do not echo raw ``input`` values (may contain PII).
        errors: list[dict] = []
        for err in exc.errors():
            item = {k: v for k, v in dict(err).items() if k != "input"}
            ctx = item.get("ctx")
            if isinstance(ctx, dict) and "error" in ctx:
                item["ctx"] = {**ctx, "error": str(ctx["error"])}
            errors.append(item)
        return JSONResponse(status_code=422, content={"detail": errors})

    include_routers(app)

    if not docs_on:
        # Explicit 404 so SPA catch-all cannot serve index.html for API docs paths (S-10).
        @app.get("/docs", include_in_schema=False)
        @app.get("/redoc", include_in_schema=False)
        @app.get("/openapi.json", include_in_schema=False)
        def _docs_disabled() -> JSONResponse:
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

    # API routes first; SPA catch-all only when FRONTEND_DIST_DIR / web/dist exists.
    if mount_frontend(app):
        logger.info("Mounted frontend SPA from FRONTEND_DIST_DIR / web/dist")

    return app


app = create_app()
