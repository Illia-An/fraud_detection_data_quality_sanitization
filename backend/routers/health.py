"""Liveness and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.observability import app_version
from backend.readiness import evaluate_readiness
from backend.schemas import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(version=app_version())


@router.get(
    "/ready",
    response_model=ReadyResponse,
    responses={
        503: {
            "description": "Snapshot missing, stale, empty, or schema mismatch",
            "model": ReadyResponse,
        }
    },
)
def ready() -> JSONResponse:
    """Data readiness (not liveness). Docker HEALTHCHECK stays on ``/health``."""
    result = evaluate_readiness()
    payload = ReadyResponse.model_validate(
        result.to_dict(version=app_version())
    ).model_dump(mode="json")
    return JSONResponse(
        status_code=200 if result.ok else 503,
        content=payload,
    )
