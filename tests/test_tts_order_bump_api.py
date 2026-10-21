"""Stage OB-3: sample + POST /api/v1/process-tts-order-bump."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.tts_order_bump_schemas import (
    OrderBumpPipelineConfig,
    OrderBumpProcessResponse,
)
from backend.tts_schemas import TtsSanitizationResponse
from tts_order_bump import generate_order_bump_preset


def test_sample_tts_order_bump_small() -> None:
    client = TestClient(create_app())
    res = client.get("/api/v1/sample/tts-order-bump/small")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["preset"] == "small"
    assert body["meta"]["row_count"] == len(body["rows"])
    assert body["meta"]["short_bump_count"] > 0
    assert "order_key" in body["rows"][0]
    assert "bump_tts_sec" in body["rows"][0]


def test_process_tts_order_bump_inline_contract() -> None:
    client = TestClient(create_app())
    rows = generate_order_bump_preset("small")
    res = client.post(
        "/api/v1/process-tts-order-bump",
        json={
            "source": "inline",
            "rows": rows,
            "config": {"tts_min_sec": 30},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body.keys()) == set(OrderBumpProcessResponse.model_fields)
    parsed = OrderBumpProcessResponse.model_validate(body)
    assert set(body["echo_config"].keys()) == set(OrderBumpPipelineConfig.model_fields)
    assert parsed.echo_config.tts_min_sec == 30
    assert parsed.kpi.bump_lt30_count > 0
    assert parsed.kpi.bump_ge30_count > 0
    assert parsed.kpi.pct_bumps_dropped_lt30 is not None
    assert parsed.kpi.pct_bumps_dropped_lt30 > 0
    assert parsed.kpi.order_tts_mean_sec is not None
    assert parsed.kpi.bump_mean_ge30_sec is not None
    assert parsed.kpi.bump_mean_raw_sec is not None
    # ge30 mean should be >= raw mean when shorts exist
    assert parsed.kpi.bump_mean_ge30_sec >= parsed.kpi.bump_mean_raw_sec
    assert parsed.store_months
    assert parsed.orders
    assert parsed.store_anomaly
    assert parsed.kvs_stats
    assert {s.kvs_group for s in parsed.kvs_stats} >= {21, 31}
    assert parsed.meta["kvs_group_count"] == len(parsed.kvs_stats)
    assert "kvs_anomaly_alert" in parsed.meta
    assert parsed.meta["source"] == "inline"
    assert parsed.meta["order_tts_policy"] == "subtract_lt30_bumps_poc"
    assert parsed.kpi.order_tts_mean_after_sec is not None
    assert parsed.kpi.order_tts_mean_sec is not None
    assert parsed.kpi.order_tts_mean_after_sec <= parsed.kpi.order_tts_mean_sec
    assert parsed.store_months[0].order_tts_mean_after_sec >= 0
    assert "execution_time_ms" in parsed.meta
    assert parsed.meta["store_anomaly_count"] == len(parsed.store_anomaly)
    assert "stores_anomaly_alert" in parsed.meta
    assert parsed.meta["anomaly_alert_pct"] == 0.2
    assert parsed.meta["kitchen_mean_policy"] == "order_vote_ge30"
    assert parsed.kpi.kitchen_mean_raw_sec is not None
    assert parsed.kpi.kitchen_mean_ge30_sec is not None
    assert parsed.kpi.order_count_ge30 > 0
    assert parsed.kpi.cycle_mean_sec is not None
    assert parsed.kpi.order_tts_penalty_sec == 0.0
    assert parsed.kpi.order_tts_weight == 1.0
    assert parsed.store_months[0].cycle_mean_sec is not None
    assert parsed.store_months[0].kitchen_mean_ge30_sec is not None
    # Dirtiest first
    pcts = [s.anomaly_pct for s in parsed.store_anomaly]
    assert pcts == sorted(pcts, reverse=True)
    sm = parsed.store_months[0]
    assert sm.bump_mean_raw_sec is not None
    assert sm.order_tts_mean_sec > 0
    top = parsed.store_anomaly[0]
    assert top.bump_valid_count >= top.bump_lt30_count
    assert top.order_tts_delta_sec == round(
        top.order_tts_mean_after_sec - top.order_tts_mean_sec, 4
    )


def test_process_tts_order_bump_rejects_empty_inline() -> None:
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts-order-bump",
        json={"source": "inline", "rows": []},
    )
    assert res.status_code == 422


def test_process_tts_order_bump_rejects_db() -> None:
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts-order-bump",
        json={"source": "db", "rows": []},
    )
    assert res.status_code == 422
    assert "db" in res.json()["detail"].lower() or "V_TTS" in str(res.json()["detail"])


def test_openapi_lists_order_bump_and_keeps_mckiti() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert "/api/v1/process-tts-order-bump" in paths
    assert "/api/v1/sample/tts-order-bump/{preset}" in paths
    assert "/api/v1/process-tts" in paths
    assert "/api/v1/sample/tts/{preset}" in paths
    assert "/api/v1/process" in paths


def test_mckiti_process_tts_still_works() -> None:
    """Regression: Stage 3 McKiti endpoint must stay intact."""
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process-tts",
        json={
            "source": "inline",
            "rows": [
                {
                    "StoreIndex": 1,
                    "SaleDate": "2026-09-01",
                    "WeborderID": "ok",
                    "UpDatetime": "2026-09-01T10:00:00",
                    "BumpDateTime": "2026-09-01T10:03:00",
                },
                {
                    "StoreIndex": 1,
                    "SaleDate": "2026-09-01",
                    "WeborderID": "short",
                    "UpDatetime": "2026-09-01T10:00:00",
                    "BumpDateTime": "2026-09-01T10:00:10",
                },
            ],
            "config": {"tts_min_sec": 30, "order_agg": "none"},
        },
    )
    assert res.status_code == 200, res.text
    parsed = TtsSanitizationResponse.model_validate(res.json())
    assert {s.step_name for s in parsed.steps} == {"actual", "ge30"}


def test_sample_then_process_wire() -> None:
    client = TestClient(create_app())
    sample = client.get("/api/v1/sample/tts-order-bump/small")
    assert sample.status_code == 200
    rows = sample.json()["rows"]
    res = client.post(
        "/api/v1/process-tts-order-bump",
        json={"source": "inline", "rows": rows, "config": {}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["kpi"]["order_count"] > 0
