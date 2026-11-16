"""Wave 9 — performance guardrails (P-01/P-02/P-05, P-04 cache, workers)."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.plan_schemas import PlanBaselineRow, PlanRequest
from backend.process_cache import (
    clear_process_result_cache,
    make_process_cache_key,
    process_result_cache_enabled,
)
from backend.request_limits import max_plan_baseline_rows
from backend.schemas import ProcessRequest
from backend.tts_plan_schemas import TtsPlanBaselineRow, TtsPlanRequest


def test_plan_baseline_rows_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLAN_MAX_BASELINE_ROWS", "2")
    with pytest.raises(ValidationError, match="baseline_rows exceeds"):
        PlanRequest(
            reference_year=2026,
            reference_month=1,
            target=80.0,
            baseline_rows=[
                PlanBaselineRow(store_id=1, five_percent=70.0),
                PlanBaselineRow(store_id=2, five_percent=71.0),
                PlanBaselineRow(store_id=3, five_percent=72.0),
            ],
        )


def test_tts_plan_baseline_rows_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLAN_MAX_BASELINE_ROWS", "2")
    with pytest.raises(ValidationError, match="baseline_rows exceeds"):
        TtsPlanRequest(
            reference_year=2026,
            reference_month=1,
            target=2.5,
            baseline_rows=[
                TtsPlanBaselineRow(store_id=1, tts=3.0),
                TtsPlanBaselineRow(store_id=2, tts=3.1),
                TtsPlanBaselineRow(store_id=3, tts=3.2),
            ],
        )


def test_default_plan_baseline_cap() -> None:
    assert max_plan_baseline_rows() == 2_000


def test_docker_entrypoint_script_exists_and_reads_workers() -> None:
    root = Path(__file__).resolve().parents[1]
    script = root / "scripts" / "docker_entrypoint.py"
    text = script.read_text(encoding="utf-8")
    assert "UVICORN_WORKERS" in text
    assert "--workers" in text
    assert "uvicorn" in text
    assert "os.execv" in text


def test_process_result_cache_default_on(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROCESS_RESULT_CACHE", raising=False)
    assert process_result_cache_enabled() is True
    monkeypatch.setenv("PROCESS_RESULT_CACHE", "0")
    assert process_result_cache_enabled() is False


def test_process_cache_key_stable() -> None:
    body = ProcessRequest(source="db", rows=[], config={})
    a = make_process_cache_key(body, snapshot_loaded_at="2026-09-22T10:03:26+00:00")
    b = make_process_cache_key(body, snapshot_loaded_at="2026-09-22T10:03:26+00:00")
    c = make_process_cache_key(body, snapshot_loaded_at="other")
    assert a == b
    assert a != c


def test_process_db_cache_hit_on_repeat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Snapshot /process miss then hit — second call must be much faster."""
    monkeypatch.setenv("SANITIZATION_SOURCE", "snapshot")
    monkeypatch.setenv("PROCESS_RESULT_CACHE", "1")
    monkeypatch.setenv("PROFILE_TRACEMALLOC", "0")
    clear_process_result_cache()

    snapshot = Path(__file__).resolve().parents[1] / "data" / "q10012_snapshot.sqlite"
    if not snapshot.is_file():
        pytest.skip("local snapshot missing")

    from backend.service import run_process

    body = ProcessRequest(
        source="db",
        rows=[],
        config={},
        from_date=__import__("datetime").date(2025, 9, 1),
        to_date=__import__("datetime").date(2025, 9, 30),
    )
    first = run_process(body)
    assert first.meta_extra.get("result_cache") == "miss"
    assert first.execution_time_ms > 0
    second = run_process(body)
    assert second.meta_extra.get("result_cache") == "hit"
    assert second.execution_time_ms < first.execution_time_ms
    assert second.result.baseline_top_box_pct == first.result.baseline_top_box_pct
    assert second.result.final_top_box_pct == first.result.final_top_box_pct
