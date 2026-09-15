"""Pipeline latency / RAM profiling (SPEC Section 5.3, TASK-08)."""

from __future__ import annotations

import time
import tracemalloc
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from typing import Any, Iterator


@dataclass(frozen=True)
class ProfileStats:
    """Wall-clock and peak allocator stats for one profiled block."""

    execution_time_ms: float
    peak_memory_mb: float

    def as_meta(self) -> dict[str, float]:
        return asdict(self)


@contextmanager
def profile_block() -> Iterator[dict[str, Any]]:
    """Measure wall time (perf_counter) and peak RAM (tracemalloc).

    Yields a mutable dict that is filled with ``execution_time_ms`` and
    ``peak_memory_mb`` when the ``with`` block exits. Nested callers that
    already have tracemalloc running are not stopped on exit.
    """
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
        _current, peak = tracemalloc.get_traced_memory()
        if not already_tracing:
            tracemalloc.stop()
        peak_delta = max(peak - baseline_peak, 0)
        out["execution_time_ms"] = round(elapsed_ms, 3)
        out["peak_memory_mb"] = round(peak_delta / (1024 * 1024), 4)


def profiling_meta(
    *,
    execution_time_ms: float,
    peak_memory_mb: float,
    rows_scanned: int,
    db_query_a_time_ms: float | None = None,
    db_query_b_time_ms: float | None = None,
) -> dict[str, Any]:
    """Build the SPEC Section 5.3 telemetry keys for ``SanitizationResponse.meta``."""
    meta: dict[str, Any] = {
        "execution_time_ms": float(execution_time_ms),
        "peak_memory_mb": float(peak_memory_mb),
        "rows_scanned": int(rows_scanned),
    }
    if db_query_a_time_ms is not None:
        meta["db_query_a_time_ms"] = float(db_query_a_time_ms)
    if db_query_b_time_ms is not None:
        meta["db_query_b_time_ms"] = float(db_query_b_time_ms)
    return meta
