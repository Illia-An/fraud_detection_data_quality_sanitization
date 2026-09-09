"""FastAPI entry point for sanitization PoC."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.db_sample import (
    DEFAULT_FROM_DATE,
    DbSampleError,
    DbSampleQuery,
    load_db_sample_from_settings,
    load_db_sample_meta_from_settings,
)
from backend.schemas import (
    HealthResponse,
    PipelineConfig,
    ProcessRequest,
    SanitizationResponse,
    SampleResponse,
    SamplePresetMeta,
    SurveyAnswerRow,
)
from backend.service import run_pipeline
from fraud_guard.synthetic import PRESETS, PresetName, generate_preset

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "API_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:4201",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _complete_echo_config(config: PipelineConfig) -> PipelineConfig:
    """Return the full effective PipelineConfig (all SPEC fields, defaults filled)."""
    return PipelineConfig.model_validate(config.model_dump())


def _as_sanitization_response(
    result: SanitizationResponse,
    *,
    meta_extra: dict | None = None,
) -> SanitizationResponse:
    """Re-validate pipeline output as the exact SPEC Section 2 response contract."""
    payload = result.model_dump(mode="python")
    payload["echo_config"] = _complete_echo_config(
        PipelineConfig.model_validate(payload["echo_config"])
    ).model_dump(mode="python")
    if meta_extra:
        payload["meta"] = {**(payload.get("meta") or {}), **meta_extra}
    return SanitizationResponse.model_validate(payload)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Fraud Guard Sanitization PoC",
        version="0.1.0",
        description="Tier 1/2 survey sanitization pipeline",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse()

    _PRESET_DESCRIPTIONS: dict[PresetName, str] = {
        "small": "2 stores × 2 months from 2026-01 — quick chart demo with Tier 1/2 signals",
        "medium": "10 stores × 6 months from 2026-01 — realistic demo (~3k+ rows)",
        "stress": "20 stores × 12 months from 2026-01 — performance / volume test",
    }

    # Register /sample/db before /sample/{preset} so "db" is not parsed as a preset.
    @app.get(
        f"{API_PREFIX}/sample/db",
        response_model=SampleResponse,
        tags=["sample"],
        responses={
            422: {"description": "Validation error"},
            503: {"description": "Database unavailable or DATABASE_URL missing"},
        },
    )
    def sample_db(
        store: float | None = Query(default=None, description="Optional PrintStore filter"),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
    ) -> SampleResponse:
        try:
            return load_db_sample_meta_from_settings(
                DbSampleQuery(
                    store=store,
                    year=year,
                    month=month,
                    from_date=DEFAULT_FROM_DATE,
                )
            )
        except DbSampleError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.get(
        f"{API_PREFIX}/sample/{{preset}}",
        response_model=SampleResponse,
        tags=["sample"],
        responses={404: {"description": "Unknown preset"}},
    )
    def sample(preset: PresetName) -> SampleResponse:
        raw_rows = generate_preset(preset)
        rows = [SurveyAnswerRow.model_validate(r) for r in raw_rows]
        stores = {r.PrintStore for r in rows if r.PrintStore is not None}
        months = {(r.Year, r.Month) for r in rows if r.Year and r.Month}
        return SampleResponse(
            preset=preset,
            rows=rows,
            meta=SamplePresetMeta(
                preset=preset,
                row_count=len(rows),
                store_count=len(stores),
                month_count=len(months),
                description=_PRESET_DESCRIPTIONS[preset],
            ),
        )

    @app.post(
        f"{API_PREFIX}/process",
        response_model=SanitizationResponse,
        response_model_exclude_unset=False,
        response_model_exclude_none=False,
        tags=["process"],
        responses={
            422: {"description": "Validation error"},
            500: {"description": "Pipeline execution error"},
            503: {"description": "Database unavailable when source=db"},
        },
    )
    def process(body: ProcessRequest) -> SanitizationResponse:
        """Run sanitization and return SPEC Section 2 ``SanitizationResponse``."""
        try:
            if body.source == "db":
                sample = load_db_sample_from_settings(
                    DbSampleQuery(from_date=DEFAULT_FROM_DATE)
                )
                if not sample.rows:
                    raise HTTPException(
                        status_code=422,
                        detail="No Q10012 rows from 2026-01-01",
                    )
                result = run_pipeline(
                    ProcessRequest(rows=sample.rows, config=body.config)
                )
                return _as_sanitization_response(
                    result,
                    meta_extra={
                        "source": "db",
                        "sample": sample.meta.model_dump(),
                    },
                )
            return _as_sanitization_response(run_pipeline(body))
        except HTTPException:
            raise
        except DbSampleError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("pipeline failed")
            raise HTTPException(status_code=500, detail="Pipeline execution failed") from exc

    return app


app = create_app()
