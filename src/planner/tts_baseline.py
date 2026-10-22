"""Synthetic monthly TTS KPI panel for the planner (no database).

Grain matches the five-percent planner panel: one row per store × year ×
month. ``tts`` is minutes. The reference month is the latest calendar month
present. Store ids stay below 500, the same cap as ``T_KPITrendAlerts``.

``small`` at the reference month is the stage-1 pair ``{10: 4.2, 20: 3.8}``
so a plan toward 3.5 min can be reviewed without AP.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

TtsKpiPresetName = Literal["small", "medium", "stress"]
STORE_ID_MAX = 499

_PRESET_SIZE: dict[TtsKpiPresetName, tuple[int, int]] = {
    "small": (2, 2),
    "medium": (8, 6),
    "stress": (20, 12),
}

# Latest month in every preset. Reference is this month.
_END_YEAR = 2025
_END_MONTH = 12


@dataclass(frozen=True)
class TtsKpiPanelRow:
    store_id: int
    year: int
    month: int
    tts: float


@dataclass(frozen=True)
class TtsKpiPanel:
    preset: TtsKpiPresetName
    period_start: str
    period_end: str
    reference_year: int
    reference_month: int
    rows: tuple[TtsKpiPanelRow, ...]

    @property
    def row_count(self) -> int:
        return len(self.rows)


def _month_sequence(n_months: int) -> list[tuple[int, int]]:
    """n_months ending at December 2025, walking backward then reversing."""
    year, month = _END_YEAR, _END_MONTH
    backward: list[tuple[int, int]] = []
    for _ in range(n_months):
        backward.append((year, month))
        month -= 1
        if month < 1:
            month = 12
            year -= 1
    backward.reverse()
    return backward


def _store_id(index: int) -> int:
    store_id = 10 * (index + 1)
    if store_id > STORE_ID_MAX:
        raise ValueError(f"synthetic store id {store_id} exceeds {STORE_ID_MAX}")
    return store_id


def _tts_minutes(store_index: int, month_index: int, n_stores: int) -> float:
    """Spread stores from about 3.2 to 5.0 min. Later months drift slightly down."""
    span = 1.6 * (store_index / max(n_stores - 1, 1))
    drift = -0.04 * month_index
    value = 3.4 + span + drift
    return round(min(30.0, max(0.0, value)), 4)


def generate_tts_kpi_panel(preset: TtsKpiPresetName) -> TtsKpiPanel:
    """Build a deterministic store×month TTS panel. Does not read or write a database."""
    if preset not in _PRESET_SIZE:
        raise ValueError(f"unknown TTS KPI preset: {preset}")
    n_stores, n_months = _PRESET_SIZE[preset]
    months = _month_sequence(n_months)
    rows: list[TtsKpiPanelRow] = []
    for store_index in range(n_stores):
        store_id = _store_id(store_index)
        for month_index, (year, month) in enumerate(months):
            if preset == "small":
                # Locked to the reviewed engine example at 2025-12.
                tts = 4.2 if store_id == 10 else 3.8
                if month != _END_MONTH:
                    tts = round(tts + 0.2, 4)
            else:
                tts = _tts_minutes(store_index, month_index, n_stores)
            rows.append(
                TtsKpiPanelRow(store_id=store_id, year=year, month=month, tts=tts)
            )
    rows.sort(key=lambda row: (row.store_id, row.year, row.month))
    start_year, start_month = months[0]
    ref_year, ref_month = months[-1]
    return TtsKpiPanel(
        preset=preset,
        period_start=f"{start_year:04d}-{start_month:02d}-01",
        period_end=f"{ref_year:04d}-{ref_month:02d}-01",
        reference_year=ref_year,
        reference_month=ref_month,
        rows=tuple(rows),
    )


def reference_baseline(panel: TtsKpiPanel) -> dict[int, float]:
    """Equal-weight plan input: store → TTS minutes at the reference month."""
    baseline: dict[int, float] = {}
    for row in panel.rows:
        if row.year == panel.reference_year and row.month == panel.reference_month:
            baseline[row.store_id] = row.tts
    if not baseline:
        raise ValueError("panel has no rows at the reference month")
    return baseline
