"""Synthetic survey generator — no live DB."""

from __future__ import annotations

from fraud_guard.synthetic import PRESETS, generate_preset
from backend.service import run_pipeline
from backend.schemas import PipelineConfig, ProcessRequest, SurveyAnswerRow


def test_presets_return_rows() -> None:
    for name in PRESETS:
        rows = generate_preset(name)
        assert len(rows) > 0
        assert all("Question_ID" in r for r in rows)


def test_small_has_multiple_stores_and_months() -> None:
    rows = generate_preset("small")
    stores = {r["PrintStore"] for r in rows}
    months = {(r["Year"], r["Month"]) for r in rows}
    assert len(stores) >= 2
    assert len(months) >= 2
    assert all(r["Year"] >= 2026 for r in rows if r.get("Year") is not None)


def test_medium_pipeline_runs() -> None:
    raw = generate_preset("medium")
    typed = [SurveyAnswerRow.model_validate(r) for r in raw[:500]]
    res = run_pipeline(ProcessRequest(rows=typed, config=PipelineConfig()))
    assert res.baseline_top_box_pct is not None
    assert len(res.store_impact_series) > 0


def test_reproducible_with_seed() -> None:
    a = generate_preset("small")
    b = generate_preset("small")
    assert len(a) == len(b)
    assert a[0]["ParticipateNumber"] == b[0]["ParticipateNumber"]
