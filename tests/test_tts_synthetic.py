"""TTS synthetic presets + sample → process-tts wire."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app
from tts_guard.pipeline import run_tts_sanitize
from tts_guard.synthetic import generate_tts_preset
from schemas.tts import TtsPipelineConfig
import pandas as pd


def test_generate_tts_preset_small_has_shorts_and_shape() -> None:
    rows = generate_tts_preset("small")
    assert len(rows) > 50
    cols = set(rows[0])
    assert {
        "StoreIndex",
        "SaleDate",
        "WeborderID",
        "UpDatetime",
        "BumpDateTime",
        "KVSGroup",
    } <= cols
    # Rough share of shorts (<30s) in the ballpark of research (~9%).
    shorts = 0
    total = 0
    for r in rows:
        if r["BumpDateTime"] is None:
            continue
        total += 1
        up = pd.Timestamp(r["UpDatetime"])
        bump = pd.Timestamp(r["BumpDateTime"])
        if (bump - up).total_seconds() < 30:
            shorts += 1
    assert total > 0
    share = shorts / total
    assert 0.03 <= share <= 0.20


def test_synthetic_ge30_raises_mean() -> None:
    rows = generate_tts_preset("small")
    result = run_tts_sanitize(
        pd.DataFrame(rows), TtsPipelineConfig(tts_min_sec=30, order_agg="none")
    )
    assert result.final_mean_tts_sec > result.baseline_mean_tts_sec
    assert result.steps[1].rows_dropped > 0


def test_sample_tts_then_process_inline() -> None:
    client = TestClient(create_app())
    sample = client.get("/api/v1/sample/tts/small")
    assert sample.status_code == 200, sample.text
    payload = sample.json()
    assert payload["meta"]["row_count"] == len(payload["rows"])
    assert payload["meta"]["store_count"] >= 2

    proc = client.post(
        "/api/v1/process-tts",
        json={
            "source": "inline",
            "rows": payload["rows"],
            "config": {"tts_min_sec": 30},
        },
    )
    assert proc.status_code == 200, proc.text
    body = proc.json()
    assert body["final_mean_tts_sec"] > body["baseline_mean_tts_sec"]
    assert body["meta"]["source"] == "inline"
