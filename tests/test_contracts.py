"""Contract tests for SPEC.md Section 2 shared data models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas import PipelineConfig, SanitizationResponse, StepMetric
from schemas.pipeline import migrate_legacy_pipeline_config


def test_pipeline_config_defaults_match_spec() -> None:
    cfg = PipelineConfig()
    assert cfg.tier1_blacklist_enabled is True
    assert cfg.tier2_freq_enabled is True
    assert cfg.tier2_freq_threshold == 3
    assert cfg.tier3_always_five_enabled is False
    assert cfg.tier3_always_five_min_n == 10
    assert cfg.tier4_enabled is True
    assert cfg.tier4_min_volume == 30
    assert cfg.tier4_z_threshold == 2.0
    assert cfg.tier4_pct_threshold == 90.0


def test_pipeline_config_accepts_legacy_keys() -> None:
    cfg = PipelineConfig.model_validate(
        {
            "tier1_freq_enabled": False,
            "tier1_freq_threshold": 5,
            "tier1_always_five_enabled": True,
            "tier1_always_five_min_n": 12,
            "tier2_min_volume": 40,
            "tier2_z_threshold": 2.5,
            "tier2_pct_threshold": 88.0,
        }
    )
    assert cfg.tier2_freq_enabled is False
    assert cfg.tier2_freq_threshold == 5
    assert cfg.tier3_always_five_enabled is True
    assert cfg.tier3_always_five_min_n == 12
    assert cfg.tier4_min_volume == 40
    assert cfg.tier4_z_threshold == 2.5
    assert cfg.tier4_pct_threshold == 88.0


def test_migrate_legacy_pipeline_config_helper() -> None:
    migrated = migrate_legacy_pipeline_config({"tier1_freq_threshold": 4})
    assert migrated["tier2_freq_threshold"] == 4


def test_pipeline_config_field_constraints() -> None:
    with pytest.raises(ValidationError):
        PipelineConfig(tier2_freq_threshold=0)
    with pytest.raises(ValidationError):
        PipelineConfig(tier2_freq_threshold=1)  # degenerate: would drop all identified rows
    with pytest.raises(ValidationError):
        PipelineConfig(tier4_min_volume=0)
    with pytest.raises(ValidationError):
        PipelineConfig(tier4_z_threshold=-0.1)
    with pytest.raises(ValidationError):
        PipelineConfig(tier4_pct_threshold=100.1)


def test_step_metric_step_name_literal() -> None:
    for step_name in ("actual", "tier1", "tier2", "tier3", "tier4"):
        StepMetric(
            step_name=step_name,  # type: ignore[arg-type]
            rows_in=10,
            rows_out=8,
            rows_dropped=2,
            top_box_pct=80.0,
        )
    with pytest.raises(ValidationError):
        StepMetric(
            step_name="1_tier1",  # type: ignore[arg-type]
            rows_in=1,
            rows_out=1,
            rows_dropped=0,
            top_box_pct=50.0,
        )


def test_sanitization_response_requires_echo_config() -> None:
    cfg = PipelineConfig()
    payload = {
        "baseline_top_box_pct": 70.0,
        "final_top_box_pct": 65.0,
        "network_delta_pp": -5.0,
        "steps": [
            {
                "step_name": "actual",
                "rows_in": 100,
                "rows_out": 100,
                "rows_dropped": 0,
                "top_box_pct": 70.0,
            }
        ],
        "high_store_months": [{"store_id": 1, "flagged": True}],
        "store_impact_series": [{"store_id": 1, "actual_five_pct": 90.0}],
        "echo_config": cfg.model_dump(),
        "meta": {"source": "inline"},
    }
    res = SanitizationResponse.model_validate(payload)
    assert res.echo_config == cfg
    assert res.network_delta_pp == pytest.approx(-5.0)

    without_echo = {k: v for k, v in payload.items() if k != "echo_config"}
    with pytest.raises(ValidationError):
        SanitizationResponse.model_validate(without_echo)


def test_contract_names_use_sanitization_not_fraud() -> None:
    for model in (PipelineConfig, StepMetric, SanitizationResponse):
        assert "fraud" not in model.__name__.lower()
        for name in model.model_fields:
            assert "fraud" not in name.lower()
