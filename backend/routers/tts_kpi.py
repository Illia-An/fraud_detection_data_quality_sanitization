"""TTS KPI sample presets and AP/snapshot panel."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app_common import API_PREFIX
from backend.tts_kpi_ap import load_ap_tts_kpi_panel
from backend.tts_plan_schemas import (
    TtsKpiApPanelResponse,
    TtsKpiPanelResponse,
    TtsKpiPanelRowOut,
)
from planner.tts_baseline import TtsKpiPresetName, generate_tts_kpi_panel
from planner.tts_kpi_ap import TtsKpiSourceError

router_sample = APIRouter(prefix=API_PREFIX, tags=["sample-tts-kpi"])
router_ap = APIRouter(prefix=API_PREFIX, tags=["tts-kpi"])


@router_sample.get(
    "/sample/tts-kpi/{preset}",
    response_model=TtsKpiPanelResponse,
    responses={404: {"description": "Unknown TTS KPI preset"}},
)
def sample_tts_kpi(preset: TtsKpiPresetName) -> TtsKpiPanelResponse:
    """Synthetic monthly TTS minutes for the planner. No database read or write."""
    panel = generate_tts_kpi_panel(preset)
    return TtsKpiPanelResponse(
        preset=panel.preset,
        period_start=panel.period_start,
        period_end=panel.period_end,
        reference_year=panel.reference_year,
        reference_month=panel.reference_month,
        row_count=panel.row_count,
        rows=[
            TtsKpiPanelRowOut(
                store_id=row.store_id,
                year=row.year,
                month=row.month,
                tts=row.tts,
            )
            for row in panel.rows
        ],
    )


@router_ap.get(
    "/tts-kpi/ap",
    response_model=TtsKpiApPanelResponse,
    responses={
        404: {"description": "AP returned no avg_serve_time_minutes rows"},
        422: {"description": "AP rows are not a usable TTS panel"},
        503: {
            "description": "TTS_KPI_SOURCE is synthetic, snapshot missing, or AP unreachable"
        },
    },
)
def tts_kpi_from_ap() -> TtsKpiApPanelResponse:
    """Read-only TTS minutes from AP, snapshot, or reject synthetic.

    Synthetic presets stay on ``/sample/tts-kpi``. Docker uses
    ``TTS_KPI_SOURCE=snapshot`` after ``refresh_tts_kpi_snapshot.py``.
    """
    try:
        panel = load_ap_tts_kpi_panel()
    except TtsKpiSourceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return TtsKpiApPanelResponse(
        period_start=panel.period_start,
        period_end=panel.period_end,
        reference_year=panel.reference_year,
        reference_month=panel.reference_month,
        row_count=panel.row_count,
        rows=[
            TtsKpiPanelRowOut(
                store_id=row.store_id,
                year=row.year,
                month=row.month,
                tts=row.tts,
            )
            for row in panel.rows
        ],
    )
