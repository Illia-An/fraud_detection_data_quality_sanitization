"""Integration: POST /api/v1/process returns SPEC Section 2 SanitizationResponse."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.schemas import PipelineConfig, SanitizationResponse, StepMetric


def _sample_rows() -> list[dict]:
    return [
        {
            "ParticipateNumber": "p1",
            "Question_ID": 10012,
            "Answer_Value": 5,
            "BlackList": "לא",
            "UserContact": "111",
            "PrintStore": 1,
            "AnswerTime": "2025-01-01T10:00:00",
            "Year": 2025,
            "Month": 1,
        },
        {
            "ParticipateNumber": "p2",
            "Question_ID": 10012,
            "Answer_Value": 5,
            "BlackList": "לא",
            "UserContact": "111",
            "PrintStore": 1,
            "AnswerTime": "2025-01-01T11:00:00",
            "Year": 2025,
            "Month": 1,
        },
        {
            "ParticipateNumber": "p3",
            "Question_ID": 10012,
            "Answer_Value": 4,
            "BlackList": "עובד",
            "UserContact": "222",
            "PrintStore": 1,
            "AnswerTime": "2025-01-01T12:00:00",
            "Year": 2025,
            "Month": 1,
        },
    ]


def test_process_returns_exact_sanitization_response_with_echo_config() -> None:
    client = TestClient(create_app())
    res = client.post(
        "/api/v1/process",
        json={
            "source": "inline",
            "rows": _sample_rows(),
            "config": {"tier1_freq_threshold": 2},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()

    assert set(body.keys()) == set(SanitizationResponse.model_fields)
    parsed = SanitizationResponse.model_validate(body)

    # Complete effective echo_config (override + defaults).
    assert set(body["echo_config"].keys()) == set(PipelineConfig.model_fields)
    assert parsed.echo_config.tier1_freq_threshold == 2
    assert parsed.echo_config.tier1_blacklist_enabled is True
    assert parsed.echo_config.tier1_always_five_enabled is False
    assert parsed.echo_config.tier1_always_five_min_n == 10
    assert parsed.echo_config.tier2_min_volume == 30
    assert parsed.echo_config.tier2_z_threshold == 2.0
    assert parsed.echo_config.tier2_pct_threshold == 90.0

    assert {s.step_name for s in parsed.steps} <= {"actual", "tier1", "tier2"}
    for step in parsed.steps:
        StepMetric.model_validate(step.model_dump())

    assert parsed.network_delta_pp == round(
        parsed.final_top_box_pct - parsed.baseline_top_box_pct, 4
    )
    assert isinstance(parsed.high_store_months, list)
    assert isinstance(parsed.store_impact_series, list)
    assert isinstance(parsed.meta, dict)


def test_process_openapi_response_model_is_sanitization_response() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json").json()
    process = schema["paths"]["/api/v1/process"]["post"]
    ref = process["responses"]["200"]["content"]["application/json"]["schema"]
    # FastAPI may inline or $ref the model.
    if "$ref" in ref:
        assert ref["$ref"].endswith("/SanitizationResponse")
    else:
        assert set(ref.get("required", [])) >= {
            "baseline_top_box_pct",
            "final_top_box_pct",
            "network_delta_pp",
            "steps",
            "echo_config",
            "meta",
        }
