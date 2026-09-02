"""FastAPI entry point for Fraud Guard sanitization PoC."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Repo root on path for ``backend`` and ``src/fraud_guard`` packages.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from backend.schemas import HealthResponse, ProcessRequest, ProcessResponse, SampleResponse, SamplePresetMeta, SurveyAnswerRow
from backend.service import run_pipeline
from fraud_guard.synthetic import PRESETS, PresetName, generate_preset

load_dotenv(_ROOT / ".env")

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "API_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:4201",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def create_app() -> FastAPI:
    app = FastAPI(
        title="Fraud Guard Sanitization PoC",
        version="0.1.0",
        description="Tier1/2/3 survey sanitization pipeline",
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
        "small": "2 stores × 2 months — quick chart demo with Tier 1/2 signals",
        "medium": "10 stores × 6 months — realistic demo (~3k+ rows)",
        "stress": "20 stores × 12 months — performance / volume test",
    }

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
        response_model=ProcessResponse,
        tags=["process"],
        responses={
            422: {"description": "Validation error"},
            500: {"description": "Pipeline execution error"},
        },
    )
    def process(body: ProcessRequest) -> ProcessResponse:
        try:
            return run_pipeline(body)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            logger.exception("pipeline failed")
            raise HTTPException(status_code=500, detail="Pipeline execution failed") from exc

    return app


app = create_app()
