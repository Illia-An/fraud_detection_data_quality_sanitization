"""Wave 9 / A007 — Docker PID-1 launcher with optional uvicorn workers.

Reads ``UVICORN_WORKERS`` (default 1, clamped 1..8) and execs uvicorn so
Docker SIGTERM reaches the server process tree.
"""

from __future__ import annotations

import os
import sys


def _workers() -> int:
    raw = os.environ.get("UVICORN_WORKERS", "1").strip() or "1"
    try:
        n = int(raw)
    except ValueError:
        n = 1
    return max(1, min(n, 8))


def main() -> None:
    workers = _workers()
    uvicorn = "/app/.venv/bin/uvicorn"
    args = [
        uvicorn,
        "backend.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--workers",
        str(workers),
    ]
    os.execv(uvicorn, args)


if __name__ == "__main__":
    main()
    raise SystemExit(1)  # execv should not return
