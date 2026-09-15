"""TASK-08: profiling context manager and /process meta telemetry."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.profiler import profile_block, profiling_meta


def test_profile_block_reports_positive_time_and_non_negative_memory() -> None:
    with profile_block() as stats:
        # Allocate enough to exercise tracemalloc peak tracking.
        _blob = bytearray(2 * 1024 * 1024)
        assert len(_blob) > 0

    assert stats["execution_time_ms"] > 0
    assert stats["peak_memory_mb"] >= 0
    assert isinstance(stats["execution_time_ms"], float)
    assert isinstance(stats["peak_memory_mb"], float)


def test_profile_block_nested_does_not_stop_outer_tracemalloc() -> None:
    with profile_block() as outer:
        with profile_block() as inner:
            _ = [0] * 10_000
        assert inner["execution_time_ms"] > 0
        assert outer == {}  # outer filled only on exit
    assert outer["execution_time_ms"] > 0
    assert outer["peak_memory_mb"] >= 0


def test_profiling_meta_includes_required_keys() -> None:
    meta = profiling_meta(
        execution_time_ms=12.5,
        peak_memory_mb=1.25,
        rows_scanned=100,
        db_query_a_time_ms=3.0,
        db_query_b_time_ms=0.0,
    )
    assert meta["execution_time_ms"] == 12.5
    assert meta["peak_memory_mb"] == 1.25
    assert meta["rows_scanned"] == 100
    assert meta["db_query_a_time_ms"] == 3.0
    assert meta["db_query_b_time_ms"] == 0.0


def test_process_meta_includes_profiling_fields() -> None:
    client = TestClient(create_app())
    rows = [
        {
            "ParticipateNumber": "p1",
            "Question_ID": 10012,
            "Answer_Value": 5,
            "BlackList": "עובד",
            "UserContact": "111",
            "PrintStore": 1,
            "AnswerTime": "2025-01-01T10:00:00",
            "Year": 2025,
            "Month": 1,
        }
    ]
    res = client.post(
        "/api/v1/process",
        json={"source": "inline", "rows": rows, "config": {}},
    )
    assert res.status_code == 200, res.text
    meta = res.json()["meta"]
    assert meta["execution_time_ms"] > 0
    assert meta["peak_memory_mb"] >= 0
    assert meta["rows_scanned"] == 1
    assert isinstance(meta["execution_time_ms"], (int, float))
    assert isinstance(meta["peak_memory_mb"], (int, float))
    assert isinstance(meta["rows_scanned"], int)
