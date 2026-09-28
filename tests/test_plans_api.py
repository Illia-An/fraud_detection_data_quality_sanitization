"""API smoke for POST /api/v1/plans."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app


def test_plans_endpoint_returns_heatmap_shape():
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/plans",
        json={
            "reference_year": 2025,
            "reference_month": 3,
            "horizon": 4,
            "target": 75.0,
            "params": {"trajectory": "uniform", "priority_power": 1.0},
            "baseline_rows": [
                {"store_id": 10, "five_percent": 68.0},
                {"store_id": 20, "five_percent": 72.0},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    metric = body["metrics"]["five_percent"]
    assert metric["current_chain"] == 70.0
    assert len(metric["chain_trajectory"]) == 4
    assert len(metric["projections"]) == 2
    assert metric["projections"][0]["months"][0]["month"] == 4


def test_plans_rejects_target_below_current():
    client = TestClient(create_app())
    response = client.post(
        "/api/v1/plans",
        json={
            "reference_year": 2025,
            "reference_month": 1,
            "horizon": 3,
            "target": 50.0,
            "baseline_rows": [{"store_id": 1, "five_percent": 80.0}],
        },
    )
    assert response.status_code == 422
