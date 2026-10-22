"""Synthetic monthly TTS panel: store × year × month, no database."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from planner.tts_baseline import (
    STORE_ID_MAX,
    generate_tts_kpi_panel,
    reference_baseline,
)


def test_small_panel_reference_is_latest_month_and_matches_engine_example():
    panel = generate_tts_kpi_panel("small")
    assert panel.reference_year == 2025
    assert panel.reference_month == 12
    assert panel.period_start == "2025-11-01"
    assert panel.period_end == "2025-12-01"
    assert panel.row_count == 4
    assert reference_baseline(panel) == {10: 4.2, 20: 3.8}
    latest = max((row.year, row.month) for row in panel.rows)
    assert latest == (panel.reference_year, panel.reference_month)


def test_rows_are_sorted_and_store_ids_stay_under_cap():
    panel = generate_tts_kpi_panel("medium")
    keys = [(row.store_id, row.year, row.month) for row in panel.rows]
    assert keys == sorted(keys)
    assert len(keys) == len(set(keys))
    assert all(row.store_id <= STORE_ID_MAX for row in panel.rows)
    assert all(0.0 <= row.tts <= 30.0 for row in panel.rows)
    assert panel.row_count == 8 * 6


def test_panel_is_deterministic():
    first = generate_tts_kpi_panel("stress")
    second = generate_tts_kpi_panel("stress")
    assert first.rows == second.rows
    assert len(reference_baseline(first)) == 20


def test_sample_tts_kpi_endpoint_serves_small_panel():
    client = TestClient(create_app())
    response = client.get("/api/v1/sample/tts-kpi/small")
    assert response.status_code == 200
    body = response.json()
    assert body["preset"] == "small"
    assert body["reference_year"] == 2025
    assert body["reference_month"] == 12
    assert body["row_count"] == 4
    december = [
        row
        for row in body["rows"]
        if row["year"] == 2025 and row["month"] == 12
    ]
    assert {row["store_id"]: row["tts"] for row in december} == {10: 4.2, 20: 3.8}

    plan = client.post(
        "/api/v1/plans-tts",
        json={
            "reference_year": body["reference_year"],
            "reference_month": body["reference_month"],
            "horizon": 6,
            "target": 3.5,
            "baseline_rows": [
                {"store_id": row["store_id"], "tts": row["tts"]} for row in december
            ],
        },
    )
    assert plan.status_code == 200
    metric = plan.json()["metrics"]["tts"]
    assert metric["current_chain"] == 4.0
    assert metric["final_chain"] == pytest.approx(3.5)
    assert metric["final_chain"] <= metric["current_chain"]
