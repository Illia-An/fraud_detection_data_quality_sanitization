"""Stage 2: pure TTS sanitization (ge30 + optional order_agg)."""

from __future__ import annotations

import pandas as pd

from schemas.tts import TtsPipelineConfig
from tts_guard.clock import attach_tts_sec, tts_seconds_series
from tts_guard.pipeline import run_tts_sanitize


def _row(
    store: int,
    sale: str,
    order: str,
    up: str,
    bump: str | None,
) -> dict:
    return {
        "StoreIndex": store,
        "SaleDate": sale,
        "WeborderID": order,
        "UpDatetime": up,
        "BumpDateTime": bump,
    }


def test_tts_seconds_series_and_attach() -> None:
    df = pd.DataFrame(
        [
            _row(1, "2026-09-01", "A", "2026-09-01T10:00:00", "2026-09-01T10:00:40"),
            _row(1, "2026-09-01", "B", "2026-09-01T10:00:00", None),
        ]
    )
    out = attach_tts_sec(df)
    assert out.loc[0, "tts_sec"] == 40.0
    assert pd.isna(out.loc[1, "tts_sec"])
    assert tts_seconds_series(df["UpDatetime"], df["BumpDateTime"]).iloc[0] == 40.0


def test_ge30_raises_mean_and_drops_shorts_and_negatives() -> None:
    """Qualitative match to research: shorts pull mean down; ge30 raises it."""
    df = pd.DataFrame(
        [
            # shorts / impossible
            _row(1, "2026-09-01", "s1", "2026-09-01T10:00:00", "2026-09-01T10:00:10"),  # 10
            _row(1, "2026-09-01", "s2", "2026-09-01T10:00:00", "2026-09-01T09:59:50"),  # -10
            # valid
            _row(1, "2026-09-01", "ok1", "2026-09-01T10:00:00", "2026-09-01T10:03:00"),  # 180
            _row(1, "2026-09-01", "ok2", "2026-09-01T10:00:00", "2026-09-01T10:04:00"),  # 240
            _row(2, "2026-09-01", "ok3", "2026-09-01T10:00:00", "2026-09-01T10:05:00"),  # 300
        ]
    )
    result = run_tts_sanitize(df, TtsPipelineConfig(tts_min_sec=30, order_agg="none"))

    assert result.steps[0].step_name == "actual"
    assert result.steps[1].step_name == "ge30"
    assert result.steps[0].rows_out == 5
    assert result.steps[1].rows_out == 3
    assert result.steps[1].rows_dropped == 2
    assert result.final_mean_tts_sec > result.baseline_mean_tts_sec
    assert result.network_delta_sec == round(
        result.final_mean_tts_sec - result.baseline_mean_tts_sec, 4
    )
    assert result.meta["negatives_after_ge30"] == 0
    assert result.echo_config.tts_min_sec == 30
    assert result.echo_config.order_agg == "none"

    # Every store×month after mean should be >= before when both exist (here store 1).
    by_store = {p.store_id: p for p in result.store_impact_series}
    assert by_store[1].after_ge30_mean_tts_sec is not None
    assert by_store[1].actual_mean_tts_sec is not None
    assert by_store[1].after_ge30_mean_tts_sec > by_store[1].actual_mean_tts_sec


def test_order_agg_max_stricter_than_avg() -> None:
    # One order, two bumps: 60 and 180 → avg 120, max 180
    df = pd.DataFrame(
        [
            _row(1, "2026-09-01", "O1", "2026-09-01T10:00:00", "2026-09-01T10:01:00"),
            _row(1, "2026-09-01", "O1", "2026-09-01T10:00:00", "2026-09-01T10:03:00"),
            _row(1, "2026-09-01", "O2", "2026-09-01T10:00:00", "2026-09-01T10:02:00"),  # 120
        ]
    )
    avg_res = run_tts_sanitize(df, TtsPipelineConfig(order_agg="avg"))
    max_res = run_tts_sanitize(df, TtsPipelineConfig(order_agg="max"))
    assert avg_res.meta["grain_final"] == "order"
    assert max_res.final_mean_tts_sec > avg_res.final_mean_tts_sec
    # After ge30, 3 bumps remain; collapse → 2 orders
    assert avg_res.store_impact_series[0].volume_after == 2


def test_null_bump_excluded_from_actual() -> None:
    df = pd.DataFrame(
        [
            _row(1, "2026-09-01", "A", "2026-09-01T10:00:00", None),
            _row(1, "2026-09-01", "B", "2026-09-01T10:00:00", "2026-09-01T10:01:00"),
        ]
    )
    result = run_tts_sanitize(df)
    assert result.steps[0].rows_out == 1
    assert result.meta["input_rows"] == 2
    assert result.meta["valid_tts_rows"] == 1


def test_deterministic_delta_invariant() -> None:
    df = pd.DataFrame(
        [
            _row(1, "2026-09-01", "A", "2026-09-01T10:00:00", "2026-09-01T10:00:20"),
            _row(1, "2026-09-01", "B", "2026-09-01T10:00:00", "2026-09-01T10:02:00"),
        ]
    )
    result = run_tts_sanitize(df)
    assert result.network_delta_sec == round(
        result.final_mean_tts_sec - result.baseline_mean_tts_sec, 4
    )
