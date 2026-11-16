"""Wave 9 — measure /process latency (p50/p95) for snapshot source=db.

Uses in-process TestClient (no Docker). Records sequential + concurrent runs.
No new packages — stdlib + existing FastAPI TestClient / concurrent.futures.

Usage:
  .\\.venv\\Scripts\\python.exe scripts/measure_process_latency.py
  .\\.venv\\Scripts\\python.exe scripts/measure_process_latency.py --concurrency 5 --runs 20

Exit 0 always after printing JSON summary (measurement tool, not a gate).
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "src"))

# Ensure snapshot mode for measurement (matches G-1 / Docker).
os.environ.setdefault("SANITIZATION_SOURCE", "snapshot")
os.environ.setdefault("PROFILE_TRACEMALLOC", "0")
# Caller may set PROCESS_RESULT_CACHE=0 for cold-path measurement.


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * (pct / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def _one_process(client, payload: dict) -> tuple[int, float, float | None]:
    started = time.perf_counter()
    res = client.post("/api/v1/process", json=payload)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    server_ms = None
    if res.status_code == 200:
        server_ms = float(res.json().get("meta", {}).get("execution_time_ms") or 0)
    return res.status_code, elapsed_ms, server_ms


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=12, help="Total process calls")
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Concurrent clients (1 = sequential)",
    )
    parser.add_argument(
        "--from-date",
        default="2025-01-01",
        help="ProcessRequest.from_date",
    )
    parser.add_argument(
        "--to-date",
        default=None,
        help="ProcessRequest.to_date (optional)",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Force PROCESS_RESULT_CACHE=0 for cold-path measurement",
    )
    args = parser.parse_args()

    if args.no_cache:
        os.environ["PROCESS_RESULT_CACHE"] = "0"

    from fastapi.testclient import TestClient

    from backend.main import create_app
    from backend.process_cache import clear_process_result_cache

    clear_process_result_cache()

    payload: dict = {
        "source": "db",
        "rows": [],
        "config": {},
        "from_date": args.from_date,
    }
    if args.to_date:
        payload["to_date"] = args.to_date

    client = TestClient(create_app())
    health = client.get("/health")
    if health.status_code != 200:
        print(json.dumps({"error": "health failed", "status": health.status_code}))
        return 1

    # Warm-up (excluded from percentiles).
    warm_code, warm_ms, _ = _one_process(client, payload)
    if warm_code not in (200, 422, 503):
        print(
            json.dumps(
                {
                    "error": "warmup process unexpected status",
                    "status": warm_code,
                    "client_ms": warm_ms,
                }
            )
        )
        return 1
    if warm_code != 200:
        print(
            json.dumps(
                {
                    "error": "warmup process not 200 — check snapshot / period",
                    "status": warm_code,
                    "body": client.post("/api/v1/process", json=payload).json(),
                },
                default=str,
            )
        )
        return 1

    client_ms: list[float] = []
    server_ms: list[float] = []
    statuses: list[int] = []

    def worker(_: int) -> tuple[int, float, float | None]:
        return _one_process(client, payload)

    conc = max(1, args.concurrency)
    runs = max(1, args.runs)
    with ThreadPoolExecutor(max_workers=conc) as pool:
        futures = [pool.submit(worker, i) for i in range(runs)]
        for fut in as_completed(futures):
            code, cms, sms = fut.result()
            statuses.append(code)
            client_ms.append(cms)
            if sms is not None:
                server_ms.append(sms)

    client_ms_sorted = sorted(client_ms)
    server_ms_sorted = sorted(server_ms)
    ok = sum(1 for s in statuses if s == 200)
    summary = {
        "source": "db",
        "sanitization_source": os.environ.get("SANITIZATION_SOURCE", "snapshot"),
        "from_date": args.from_date,
        "to_date": args.to_date,
        "process_result_cache": os.environ.get("PROCESS_RESULT_CACHE", "1"),
        "runs": runs,
        "concurrency": conc,
        "ok": ok,
        "warmup_client_ms": round(warm_ms, 3),
        "client_ms": {
            "p50": round(_percentile(client_ms_sorted, 50), 3),
            "p95": round(_percentile(client_ms_sorted, 95), 3),
            "max": round(max(client_ms_sorted), 3) if client_ms_sorted else None,
            "mean": round(statistics.fmean(client_ms_sorted), 3)
            if client_ms_sorted
            else None,
        },
        "server_execution_time_ms": {
            "p50": round(_percentile(server_ms_sorted, 50), 3)
            if server_ms_sorted
            else None,
            "p95": round(_percentile(server_ms_sorted, 95), 3)
            if server_ms_sorted
            else None,
            "max": round(max(server_ms_sorted), 3) if server_ms_sorted else None,
            "mean": round(statistics.fmean(server_ms_sorted), 3)
            if server_ms_sorted
            else None,
        },
        "decision_hints": {
            "result_cache_P04": "enabled by default after cold p95 > assumed SLA",
            "celery_RQ_9_5": "defer while G-1=snapshot; cache + optional workers first",
            "assumed_sla_ms": 5000,
        },
    }
    print(json.dumps(summary, indent=2))
    return 0 if ok == runs else 2


if __name__ == "__main__":
    raise SystemExit(main())
