"""API smoke for POST /api/v1/plans-tts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app


def test_plans_tts_returns_minute_trajectory():
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/plans-tts",
        json={
            "reference_year": 2025,
            "reference_month": 3,
            "horizon": 6,
            "target": 3.5,
            "params": {"trajectory": "uniform", "priority_power": 1.0, "max_monthly_improve": 0.25},
            "baseline_rows": [
                {"store_id": 10, "tts": 4.2},
                {"store_id": 20, "tts": 3.8},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    metric = body["metrics"]["tts"]
    assert metric["metric_id"] == "tts"
    assert metric["unit"] == "min"
    assert metric["direction"] == "lower_is_better"
    assert metric["current_chain"] == 4.0
    assert metric["required_change"] == 0.5
    assert metric["final_chain"] == 3.5
    assert metric["feasible"] is True
    assert len(metric["chain_trajectory"]) == 6
    assert len(metric["projections"]) == 2
    assert metric["projections"][0]["months"][0]["month"] == 4
    assert metric["chain_trajectory"][-1]["score"] <= metric["current_chain"]


def test_plans_tts_rejects_target_above_current():
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/plans-tts",
        json={
            "reference_year": 2025,
            "reference_month": 3,
            "horizon": 6,
            "target": 4.5,
            "baseline_rows": [
                {"store_id": 10, "tts": 4.2},
                {"store_id": 20, "tts": 3.8},
            ],
        },
    )
    assert response.status_code == 422
