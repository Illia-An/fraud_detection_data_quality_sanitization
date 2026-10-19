"""Stage 3: POST /api/v1/process-tts."""

from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.tts_schemas import TtsPipelineConfig, TtsSanitizationResponse
from schemas.tts import TtsStepMetric


def _sample_tts_rows() -> list[dict]:
    return [
        {
            "StoreIndex": 1,
            "SaleDate": "2026-09-01",
            "WeborderID": "s1",
            "UpDatetime": "2026-09-01T10:00:00",
            "BumpDateTime": "2026-09-01T10:00:10",
        },
        {
            "StoreIndex": 1,
            "SaleDate": "2026-09-01",
            "WeborderID": "ok1",
            "UpDatetime": "2026-09-01T10:00:00",
            "BumpDateTime": "2026-09-01T10:03:00",
        },
        {
            "StoreIndex": 1,
            "SaleDate": "2026-09-01",
            "WeborderID": "ok2",
            "UpDatetime": "2026-09-01T10:00:00",
            "BumpDateTime": "2026-09-01T10:04:00",
        },
    ]


def test_process_tts_inline_returns_contract() -> None:
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts",
        json={
            "source": "inline",
            "rows": _sample_tts_rows(),
            "config": {"tts_min_sec": 30, "order_agg": "none"},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body.keys()) == set(TtsSanitizationResponse.model_fields)
    parsed = TtsSanitizationResponse.model_validate(body)
    assert set(body["echo_config"].keys()) == set(TtsPipelineConfig.model_fields)
    assert parsed.echo_config.tts_min_sec == 30
    assert {s.step_name for s in parsed.steps} == {"actual", "ge30"}
    for step in parsed.steps:
        TtsStepMetric.model_validate(step.model_dump())
    assert parsed.final_mean_tts_sec > parsed.baseline_mean_tts_sec
    assert parsed.network_delta_sec == round(
        parsed.final_mean_tts_sec - parsed.baseline_mean_tts_sec, 4
    )
    assert parsed.meta["source"] == "inline"
    assert "execution_time_ms" in parsed.meta
    assert parsed.meta["rows_scanned"] == 3


def test_process_tts_rejects_inline_without_rows() -> None:
    client = TestClient(create_app())
    res = client.post("/api/v1/process-tts", json={"source": "inline", "rows": []})
    assert res.status_code == 422


def test_process_tts_rejects_bad_period() -> None:
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts",
        json={
            "source": "inline",
            "rows": _sample_tts_rows(),
            "from_date": "2026-10-01",
            "to_date": "2026-09-01",
        },
    )
    assert res.status_code == 422


def test_process_tts_openapi_lists_route() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json").json()
    assert "/api/v1/process-tts" in schema["paths"]
    assert "/api/v1/process" in schema["paths"]


def test_process_tts_db_uses_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    frame = pd.DataFrame(_sample_tts_rows())
    monkeypatch.setattr(
        "backend.tts_service.load_tts_bump_rows_from_settings",
        lambda *a, **k: (frame, 12.5),
    )
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts",
        json={
            "source": "db",
            "from_date": "2026-09-01",
            "to_date": "2026-09-30",
            "config": {},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["source"] == "db"
    assert body["meta"]["period_start"] == "2026-09-01"
    assert body["meta"]["period_end"] == "2026-09-30"
    assert body["meta"]["db_tts_rows_time_ms"] == 12.5


def test_process_tts_db_empty_period(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "backend.tts_service.load_tts_bump_rows_from_settings",
        lambda *a, **k: (pd.DataFrame(), 1.0),
    )
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts",
        json={"source": "db", "from_date": "2026-09-01", "to_date": "2026-09-02"},
    )
    assert res.status_code == 422
    assert "No TTS bump rows" in res.json()["detail"]
