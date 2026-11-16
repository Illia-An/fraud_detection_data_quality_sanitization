"""Request body size limits (Wave 3 / S-06)."""

from __future__ import annotations

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def max_body_bytes() -> int:
    """Default 32 MiB; override with ``PROCESS_MAX_BODY_BYTES``."""
    raw = os.environ.get("PROCESS_MAX_BODY_BYTES", "").strip()
    if raw:
        return max(1, int(raw))
    return 32 * 1024 * 1024


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
