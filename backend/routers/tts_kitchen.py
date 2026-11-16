"""TTS kitchen before/after endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from backend.app_common import API_PREFIX
from backend.tts_kitchen_queries import KitchenReadError
from backend.tts_kitchen_schemas import KitchenBeforeAfterResponse
from backend.tts_kitchen_service import run_tts_kitchen_before_after

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["tts-kitchen"])


@router.get(
    "/tts-kitchen/before-after",
    response_model=KitchenBeforeAfterResponse,
    response_model_exclude_none=False,
    responses={
        503: {"description": "Kitchen view read failed"},
        500: {"description": "Kitchen before/after fold failed"},
    },
)
def tts_kitchen_before_after(
    min_sec: int = Query(default=30, ge=0),
) -> KitchenBeforeAfterResponse:
    """Before/after for the fixed kitchen window. Read-only.

    ``min_sec`` drops shorter positions. A position of exactly ``min_sec`` stays.
    """
    try:
        return run_tts_kitchen_before_after(min_sec=min_sec)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except KitchenReadError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Kitchen before/after read failed")
        raise HTTPException(
            status_code=500,
            detail="Kitchen before/after read failed",
        ) from exc
