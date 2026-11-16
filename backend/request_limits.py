"""Request body / inline row limits (Wave 3 / S-06, Wave 9 / P-02 P-05)."""

from __future__ import annotations

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Absolute pydantic / OpenAPI ceiling — env may lower (not raise above this).
HARD_MAX_PROCESS_ROWS = 50_000
# Covers largest UI synthetic preset (stress ≈ 13k) with small headroom.
DEFAULT_MAX_PROCESS_ROWS = 15_000
# Enough for stress JSON (~few MiB); override via PROCESS_MAX_BODY_BYTES.
DEFAULT_MAX_BODY_BYTES = 8 * 1024 * 1024
# Plan / TTS baseline store rows (Israel chain << this).
DEFAULT_MAX_PLAN_BASELINE_ROWS = 2_000


def _truthy(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _falsy(raw: str) -> bool:
    return raw.strip().lower() in ("0", "false", "no", "off")


def max_body_bytes() -> int:
    """Default 8 MiB (Wave 9); override with ``PROCESS_MAX_BODY_BYTES``."""
    raw = os.environ.get("PROCESS_MAX_BODY_BYTES", "").strip()
    if raw:
        return max(1, int(raw))
    return DEFAULT_MAX_BODY_BYTES


def max_process_rows() -> int:
    """Inline row cap; override with ``PROCESS_MAX_ROWS`` (≤ hard ceiling)."""
    raw = os.environ.get("PROCESS_MAX_ROWS", "").strip()
    if raw:
        return max(1, min(int(raw), HARD_MAX_PROCESS_ROWS))
    return DEFAULT_MAX_PROCESS_ROWS


def max_plan_baseline_rows() -> int:
    """Cap for planner baseline_rows; override with ``PLAN_MAX_BASELINE_ROWS``."""
    raw = os.environ.get("PLAN_MAX_BASELINE_ROWS", "").strip()
    if raw:
        return max(1, int(raw))
    return DEFAULT_MAX_PLAN_BASELINE_ROWS


def inline_allowed() -> bool:
    """Whether ``source=inline`` is accepted.

    Default: allowed (local synthetic demos). Set ``PROCESS_ALLOW_INLINE=0``
    to reject inline payloads (prod snapshot-only hardening).
    """
    raw = os.environ.get("PROCESS_ALLOW_INLINE", "").strip()
    if raw and _falsy(raw):
        return False
    if raw and _truthy(raw):
        return True
    return True


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds the configured ceiling."""

    def __init__(self, app, *, max_bytes: int | None = None) -> None:
        super().__init__(app)
        self.max_bytes = max_body_bytes() if max_bytes is None else max_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        raw = request.headers.get("content-length")
        if raw is not None:
            try:
                length = int(raw)
            except ValueError:
                length = -1
            if length > self.max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": (
                            f"Request body too large ({length} bytes); "
                            f"limit is {self.max_bytes} bytes"
                        )
                    },
                )
        return await call_next(request)
