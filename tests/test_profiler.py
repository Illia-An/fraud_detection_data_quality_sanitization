"""TASK-08 / Wave 9 P-01: profiling context manager and /process meta telemetry."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.profiler import memory_profiling_enabled, profile_block, profiling_meta


def test_memory_profiling_disabled_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROFILE_TRACEMALLOC", raising=False)
    assert memory_profiling_enabled() is False


def test_profile_block_wall_clock_without_tracemalloc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROFILE_TRACEMALLOC", raising=False)
    with profile_block() as stats:
        _blob = bytearray(256 * 1024)
        assert len(_blob) > 0

    assert stats["execution_time_ms"] > 0
    assert stats["peak_memory_mb"] is None


def test_profile_block_reports_memory_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROFILE_TRACEMALLOC", "1")
    with profile_block() as stats:
        # Allocate enough to exercise tracemalloc peak tracking.
        _blob = bytearray(2 * 1024 * 1024)
        assert len(_blob) > 0

    assert stats["execution_time_ms"] > 0
    assert stats["peak_memory_mb"] is not None
    assert stats["peak_memory_mb"] >= 0
    assert isinstance(stats["peak_memory_mb"], float)


def test_profile_block_nested_does_not_stop_outer_tracemalloc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROFILE_TRACEMALLOC", "1")
    with profile_block() as outer:
        with profile_block() as inner:
            _ = [0] * 10_000
        assert inner["execution_time_ms"] > 0
        assert outer == {}  # outer filled only on exit
    assert outer["execution_time_ms"] > 0
    assert outer["peak_memory_mb"] is not None
    assert outer["peak_memory_mb"] >= 0


def test_profiling_meta_omits_peak_when_none() -> None:
    meta = profiling_meta(
        execution_time_ms=12.5,
        peak_memory_mb=None,
        rows_scanned=100,
        db_query_a_time_ms=3.0,
        db_query_b_time_ms=0.0,
    )
    assert meta["execution_time_ms"] == 12.5
    assert "peak_memory_mb" not in meta
    assert meta["rows_scanned"] == 100
    assert meta["db_query_a_time_ms"] == 3.0
    assert meta["db_query_b_time_ms"] == 0.0


def test_profiling_meta_includes_peak_when_set() -> None:
    meta = profiling_meta(
        execution_time_ms=12.5,
        peak_memory_mb=1.25,
        rows_scanned=100,
    )
    assert meta["peak_memory_mb"] == 1.25


def test_process_meta_omits_peak_memory_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROFILE_TRACEMALLOC", raising=False)
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
    assert "peak_memory_mb" not in meta
    assert meta["rows_scanned"] == 1


def test_process_meta_includes_peak_memory_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROFILE_TRACEMALLOC", "1")
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
