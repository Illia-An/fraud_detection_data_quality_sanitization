"""API key AuthN for ``/api/v1/*`` (Wave 6 / S-02 P1).

When ``API_KEY`` is unset, auth is disabled (local/dev). When set, requests to
``/api/v1/*`` must send the same value via ``X-API-Key`` or
``Authorization: Bearer <key>``. ``/health`` and ``/ready`` stay open.
"""

from __future__ import annotations

import hmac
import os
import secrets
from typing import Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

API_KEY_HEADER = "X-API-Key"
API_PREFIX = "/api/v1"


def configured_api_key() -> str | None:
    raw = os.environ.get("API_KEY", "").strip()
    return raw or None


def auth_enabled() -> bool:
    return configured_api_key() is not None


def extract_presented_key(request: Request) -> str | None:
    header = request.headers.get(API_KEY_HEADER, "").strip()
    if header:
        return header
    auth = request.headers.get("authorization", "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        return token or None
    return None


def keys_match(presented: str | None, expected: str) -> bool:
    if not presented:
        return False
    return hmac.compare_digest(presented, expected)


def is_protected_path(path: str) -> bool:
    return path == API_PREFIX or path.startswith(API_PREFIX + "/")


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Reject protected API routes without a valid API key when configured."""

    def __init__(
        self,
        app,
        *,
        open_prefixes: Iterable[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.open_prefixes = tuple(open_prefixes or ())

    async def dispatch(self, request: Request, call_next) -> Response:
        expected = configured_api_key()
        if expected is None:
            return await call_next(request)

        path = request.url.path
        if not is_protected_path(path):
            return await call_next(request)
        for prefix in self.open_prefixes:
            if path == prefix or path.startswith(prefix.rstrip("/") + "/"):
                return await call_next(request)

        presented = extract_presented_key(request)
        if not keys_match(presented, expected):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"},
                headers={"WWW-Authenticate": "Bearer, X-API-Key"},
            )
        return await call_next(request)


def new_dev_api_key() -> str:
    """Helper for docs/tests — not used at runtime."""
    return secrets.token_urlsafe(24)
