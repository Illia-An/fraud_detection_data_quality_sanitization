"""Pipeline latency / RAM profiling (SPEC Section 5.3, TASK-08).

Wave 9 / P-01: ``tracemalloc`` is opt-in via ``PROFILE_TRACEMALLOC`` (default off).
Wall-clock timing always runs; ``peak_memory_mb`` is omitted unless enabled.
"""

from __future__ import annotations

import os
import time
import tracemalloc
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from typing import Any, Iterator


def memory_profiling_enabled() -> bool:
    """True when ``PROFILE_TRACEMALLOC`` is truthy (1/true/yes/on)."""
    raw = os.environ.get("PROFILE_TRACEMALLOC", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class ProfileStats:
    """Wall-clock and optional peak allocator stats for one profiled block."""

    execution_time_ms: float
    peak_memory_mb: float | None = None

    def as_meta(self) -> dict[str, float]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@contextmanager
def profile_block() -> Iterator[dict[str, Any]]:
    """Measure wall time; optionally peak RAM via ``tracemalloc``.

    Yields a mutable dict filled on exit with ``execution_time_ms`` and, when
    memory profiling is enabled, ``peak_memory_mb``. Nested callers that
    already have tracemalloc running are not stopped on exit.
    """
    use_mem = memory_profiling_enabled()
    already_tracing = False
    baseline_peak = 0
    if use_mem:
        already_tracing = tracemalloc.is_tracing()
        if not already_tracing:
            tracemalloc.start()
        # Snapshot baseline so peak reflects allocations inside this block.
        if already_tracing:
            baseline_peak = tracemalloc.get_traced_memory()[1]
        else:
            baseline_peak = 0

    started = time.perf_counter()
    out: dict[str, Any] = {}
    try:
        yield out
    finally:
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        out["execution_time_ms"] = round(elapsed_ms, 3)
        if use_mem:
            _current, peak = tracemalloc.get_traced_memory()
            if not already_tracing:
                tracemalloc.stop()
            peak_delta = max(peak - baseline_peak, 0)
            out["peak_memory_mb"] = round(peak_delta / (1024 * 1024), 4)
        else:
            out["peak_memory_mb"] = None


def profiling_meta(
    *,
    execution_time_ms: float,
    peak_memory_mb: float | None,
    rows_scanned: int,
    db_query_a_time_ms: float | None = None,
    db_query_b_time_ms: float | None = None,
) -> dict[str, Any]:
    """Build the SPEC Section 5.3 telemetry keys for ``SanitizationResponse.meta``."""
    meta: dict[str, Any] = {
        "execution_time_ms": float(execution_time_ms),
        "rows_scanned": int(rows_scanned),
    }
    if peak_memory_mb is not None:
        meta["peak_memory_mb"] = float(peak_memory_mb)
    if db_query_a_time_ms is not None:
        meta["db_query_a_time_ms"] = float(db_query_a_time_ms)
    if db_query_b_time_ms is not None:
        meta["db_query_b_time_ms"] = float(db_query_b_time_ms)
    return meta
