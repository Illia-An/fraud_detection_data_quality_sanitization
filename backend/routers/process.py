"""POST /process orchestration endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from backend.app_common import API_PREFIX, as_sanitization_response
from backend.db_sample import DbSampleError
from backend.observability import log_event
from backend.schemas import ProcessRequest, SanitizationResponse
from backend.service import run_process

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["process"])


@router.post(
    "/process",
    response_model=SanitizationResponse,
    response_model_exclude_unset=False,
    response_model_exclude_none=False,
    responses={
        422: {"description": "Validation error"},
        500: {"description": "Pipeline execution error"},
        503: {"description": "Database unavailable when source=db"},
    },
)
def process(body: ProcessRequest) -> SanitizationResponse:
    """Run sanitization and return SPEC Section 2 ``SanitizationResponse``."""
    try:
        outcome = run_process(body)
        response = as_sanitization_response(
            outcome.result, meta_extra=outcome.meta_extra
        )
        log_event(
            "process_done",
            source=str(outcome.meta_extra.get("source") or body.source),
            sanitization_source=outcome.meta_extra.get("sanitization_source"),
            query_b_mode=outcome.meta_extra.get("query_b_mode")
            or response.meta.get("query_b_mode"),
            period_start=outcome.meta_extra.get("period_start"),
            period_end=outcome.meta_extra.get("period_end"),
            rows_scanned=outcome.rows_scanned,
            query_a_total_responses=outcome.meta_extra.get("query_a_total_responses"),
            db_query_a_time_ms=outcome.db_query_a_time_ms,
            db_query_b_time_ms=outcome.db_query_b_time_ms,
            execution_time_ms=outcome.execution_time_ms,
            result_cache=outcome.meta_extra.get("result_cache"),
            snapshot_loaded_at=outcome.meta_extra.get("snapshot_loaded_at"),
            snapshot_age_s=outcome.meta_extra.get("snapshot_age_s"),
            enabled_tiers={
                "tier1_blacklist": body.config.tier1_blacklist_enabled,
                "tier2_freq": body.config.tier2_freq_enabled,
                "tier3_always_five": body.config.tier3_always_five_enabled,
                "tier4": body.config.tier4_enabled,
            },
        )
        return response
    except HTTPException:
        raise
    except DbSampleError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("pipeline failed")
        raise HTTPException(status_code=500, detail="Pipeline execution failed") from exc
