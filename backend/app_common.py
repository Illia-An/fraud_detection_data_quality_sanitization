"""Shared helpers for FastAPI routers (Wave 7 / M-03)."""

from __future__ import annotations

from pathlib import Path

from backend.schemas import PipelineConfig, SanitizationResponse
from planner.plan_store import PlanStore, default_plan_store_path

_ROOT = Path(__file__).resolve().parents[1]
API_PREFIX = "/api/v1"


def complete_echo_config(config: PipelineConfig) -> PipelineConfig:
    """Return the full effective PipelineConfig (all SPEC fields, defaults filled)."""
    return PipelineConfig.model_validate(config.model_dump())


def as_sanitization_response(
    result: SanitizationResponse,
    *,
    meta_extra: dict | None = None,
) -> SanitizationResponse:
    """Re-validate pipeline output as the exact SPEC Section 2 response contract."""
    payload = result.model_dump(mode="python")
    payload["echo_config"] = complete_echo_config(
        PipelineConfig.model_validate(payload["echo_config"])
    ).model_dump(mode="python")
    if meta_extra:
        payload["meta"] = {**(payload.get("meta") or {}), **meta_extra}
    return SanitizationResponse.model_validate(payload)


def plan_store() -> PlanStore:
    """SQLite Baseline Plan versions (PLAN_STORE_PATH or data/plan_store.sqlite)."""
    return PlanStore(default_plan_store_path(_ROOT))
