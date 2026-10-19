"""Wire TTS DB/inline rows → ``tts_guard.run_tts_sanitize`` (Stage 3)."""

from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

from backend.profiler import profile_block, profiling_meta
from backend.tts_queries import (
    DEFAULT_TTS_FROM_DATE,
    DEFAULT_TTS_VIEW,
    load_tts_bump_rows_from_settings,
)
from backend.tts_schemas import TtsProcessRequest, TtsSanitizationResponse
from schemas.tts import TtsPipelineConfig
from tts_guard.pipeline import run_tts_sanitize


def _rows_to_frame(request: TtsProcessRequest) -> pd.DataFrame:
    return pd.DataFrame([r.model_dump(mode="python") for r in request.rows])


def run_tts_process(request: TtsProcessRequest) -> TtsSanitizationResponse:
    """Execute TTS sanitization for API ``/process-tts``."""
    cfg = TtsPipelineConfig.model_validate(request.config.model_dump())
    db_fetch_ms: float | None = None
    period_start: date | None = None
    period_end: date | None = None

    with profile_block() as profile:
        if request.source == "db":
            period_start = request.from_date or DEFAULT_TTS_FROM_DATE
            period_end = request.to_date
            frame, db_fetch_ms = load_tts_bump_rows_from_settings(
                period_start,
                period_end,
                store_ids=request.store_ids,
            )
            if frame.empty:
                end_label = (
                    period_end.isoformat() if period_end is not None else "latest"
                )
                raise ValueError(
                    f"No TTS bump rows from {period_start.isoformat()} to {end_label}"
                )
        else:
            frame = _rows_to_frame(request)

        result = run_tts_sanitize(frame, cfg)

    meta_extra: dict[str, Any] = {
        "source": request.source,
        "source_view": DEFAULT_TTS_VIEW,
        **profiling_meta(
            execution_time_ms=float(profile["execution_time_ms"]),
            peak_memory_mb=float(profile["peak_memory_mb"]),
            rows_scanned=int(len(frame)),
        ),
    }
    if db_fetch_ms is not None:
        meta_extra["db_tts_rows_time_ms"] = round(db_fetch_ms, 3)
    if request.source == "db":
        assert period_start is not None
        meta_extra["period_start"] = period_start.isoformat()
        meta_extra["period_end"] = (
            period_end.isoformat() if period_end is not None else None
        )
        if request.store_ids is not None:
            meta_extra["store_ids"] = list(request.store_ids)

    payload = result.model_dump(mode="python")
    payload["echo_config"] = cfg.model_dump(mode="python")
    payload["meta"] = {**(payload.get("meta") or {}), **meta_extra}
    return TtsSanitizationResponse.model_validate(payload)
