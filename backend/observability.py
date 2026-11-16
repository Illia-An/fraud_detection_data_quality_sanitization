"""JSON logging, request_id, and lifecycle events (Wave 4 / OB-01, A005)."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_CONFIGURED = False


def app_version() -> str:
    return os.environ.get("APP_VERSION", "0.1.0").strip() or "0.1.0"


def get_request_id() -> str | None:
    return _request_id.get()


class JsonLogFormatter(logging.Formatter):
    """One JSON object per line on stdout."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "version": app_version(),
        }
        rid = _request_id.get()
        if rid:
            payload["request_id"] = rid
        event = getattr(record, "event_name", None)
        if event:
            payload["event"] = event
        structured = getattr(record, "structured", None)
        if isinstance(structured, dict):
            for key, value in structured.items():
                if key in payload:
                    continue
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging() -> None:
    """Attach a JSON stdout handler once (idempotent)."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    root = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter())
    root.addHandler(handler)
    if root.level == logging.NOTSET or root.level > logging.INFO:
        root.setLevel(logging.INFO)
    _CONFIGURED = True


def log_event(
    event: str,
    *,
    level: int = logging.INFO,
    logger: logging.Logger | None = None,
    **fields: Any,
) -> None:
    """Emit a structured application event (JSON line via formatter)."""
    target = logger or logging.getLogger("backend")
    # Drop Nones so ops greps stay clean; keep False/0.
    cleaned = {k: v for k, v in fields.items() if v is not None}
    target.log(
        level,
        event,
        extra={"event_name": event, "structured": cleaned},
    )


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Echo ``X-Request-ID`` and emit a ``request`` access event."""

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = request.headers.get("x-request-id", "").strip()
        rid = incoming or str(uuid.uuid4())
        token = _request_id.set(rid)
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = rid
            return response
        except Exception:
            status = 500
            raise
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000.0, 3)
            route = request.url.path
            route_template = route
            endpoint = request.scope.get("endpoint")
            # Prefer FastAPI route template when available after routing.
            route_obj = request.scope.get("route")
            path_format = getattr(route_obj, "path", None)
            if isinstance(path_format, str) and path_format:
                route_template = path_format
            level = logging.INFO if status < 400 else (
                logging.WARNING if status < 500 else logging.ERROR
            )
            log_event(
                "request" if status < 400 else "request_failed",
                level=level,
                method=request.method,
                route=route_template,
                path=route,
                status=status,
                duration_ms=duration_ms,
                endpoint=getattr(endpoint, "__name__", None),
            )
            _request_id.reset(token)


def log_startup(*, sources: dict[str, Any]) -> None:
    """Startup banner: sources / schema / rows — no secrets or filesystem paths."""
    log_event("startup", **sources)


def log_shutdown(*, reason: str = "process_exit") -> None:
    log_event("shutdown", reason=reason)
