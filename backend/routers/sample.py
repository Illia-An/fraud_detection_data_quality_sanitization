"""Synthetic and DB sample endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.app_common import API_PREFIX
from backend.db_sample import (
    DEFAULT_FROM_DATE,
    DbSampleError,
    DbSampleQuery,
    load_db_sample_meta_from_settings,
)
from backend.schemas import SamplePresetMeta, SampleResponse, SurveyAnswerRow
from fraud_guard.synthetic import PresetName, generate_preset

_PRESET_DESCRIPTIONS: dict[PresetName, str] = {
    "small": "2 stores × 2 months from 2026-01 — quick chart demo with Tier 1/2 signals",
    "medium": "10 stores × 6 months from 2026-01 — realistic demo (~3k+ rows)",
    "stress": "20 stores × 12 months from 2026-01 — performance / volume test",
}

# Registered before ``router_preset`` so ``db`` is not parsed as a preset.
router_db = APIRouter(prefix=API_PREFIX, tags=["sample"])
router_preset = APIRouter(prefix=API_PREFIX, tags=["sample"])


@router_db.get(
    "/sample/db",
    response_model=SampleResponse,
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


@router_preset.get(
    "/sample/{preset}",
    response_model=SampleResponse,
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
