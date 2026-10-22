"""Map a read-only AP export of avg_serve_time_minutes into a TTS panel.

The export columns are ``StoreID_external``, ``year``, ``month``, and
``KPI_Score``. ``KPI_Score`` becomes ``tts`` (minutes). No other KPI is kept.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from planner.tts_baseline import TtsKpiPanelRow

KPI_NAME = "avg_serve_time_minutes"
STORE_ID_CAP = 500
DEFAULT_TABLE = "AP.dbo.T_KPITrendAlerts"
TTS_FLOOR_MIN = 0.0
TTS_CEILING_MIN = 30.0

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_SELECT_COLUMNS = ("StoreID_external", "year", "month", "KPI_Score")


class TtsKpiSourceError(Exception):
    """AP TTS minutes could not be loaded. ``message`` has no secrets or row values."""

    def __init__(self, message: str, *, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ApTtsKpiPanel:
    period_start: str
    period_end: str
    reference_year: int
    reference_month: int
    rows: tuple[TtsKpiPanelRow, ...]

    @property
    def row_count(self) -> int:
        return len(self.rows)


def qualify_table(raw: str) -> str:
    """Allow ``name``, ``schema.name``, or ``db.schema.name``. Nothing else."""
    parts = [part.strip() for part in raw.split(".")]
    if not 1 <= len(parts) <= 3 or not all(_IDENT.fullmatch(part) for part in parts):
        raise TtsKpiSourceError(
            "TTS_KPI_TABLE must be a bare table name like AP.dbo.T_KPITrendAlerts.",
            status_code=503,
        )
    return ".".join(parts)


def tts_kpi_select_sql(table: str) -> str:
    """Single read-only SELECT. The table name is a checked identifier, not user SQL."""
    qualified = qualify_table(table)
    columns = ", ".join(_SELECT_COLUMNS)
    return (
        f"SELECT {columns}\n"
        f"FROM {qualified}\n"
        "WHERE KPI = :kpi\n"
        "  AND StoreID_external < :store_cap"
    )


def dreamfactory_query() -> dict[str, str]:
    """DreamFactory filter for the same four columns and the same KPI."""
    return {
        "fields": ",".join(_SELECT_COLUMNS),
        "filter": f"(KPI='{KPI_NAME}') and (StoreID_external<{STORE_ID_CAP})",
    }


def _cell(raw: Mapping[str, Any], *names: str) -> Any:
    lowered = {str(key).lower(): value for key, value in raw.items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    raise TtsKpiSourceError(
        "AP row is missing StoreID_external, year, month, or KPI_Score.",
        status_code=422,
    )


def _as_int(value: Any, label: str) -> int:
    try:
        number = float(value)
        whole = int(number)
    except (TypeError, ValueError) as exc:
        raise TtsKpiSourceError(
            f"AP {label} is not a number.",
            status_code=422,
        ) from exc
    if whole != number:
        raise TtsKpiSourceError(f"AP {label} is not a whole number.", status_code=422)
    return whole


def _usable_minutes(raw: Mapping[str, Any]) -> float | None:
    """One alert score in 0–30 minutes. Empty and out-of-range scores are skipped."""
    score = _cell(raw, "KPI_Score", "tts")
    if score is None or (isinstance(score, str) and score.strip() == ""):
        return None
    try:
        tts = float(score)
    except (TypeError, ValueError) as exc:
        raise TtsKpiSourceError("AP KPI_Score is not a number.", status_code=422) from exc
    if tts != tts or tts < TTS_FLOOR_MIN or tts > TTS_CEILING_MIN:
        return None
    return tts


def rows_to_panel(raw_rows: list[Mapping[str, Any]]) -> ApTtsKpiPanel:
    """One cell per store and month. Several alerts on that cell become their mean.

    Stores at or above 500 and any KPI other than avg_serve_time_minutes are
    dropped. Reference month is the latest month that remains.
    """
    buckets: dict[tuple[int, int, int], list[float]] = {}
    for raw in raw_rows:
        lowered = {str(key).lower(): value for key, value in raw.items()}
        if "kpi" in lowered and str(lowered["kpi"]).strip() != KPI_NAME:
            continue
        store_id = _as_int(_cell(raw, "StoreID_external", "store_id"), "store id")
        if store_id < 0 or store_id >= STORE_ID_CAP:
            continue
        year = _as_int(_cell(raw, "year"), "year")
        month = _as_int(_cell(raw, "month"), "month")
        if month < 1 or month > 12 or year < 2000 or year > 2100:
            raise TtsKpiSourceError(
                "AP year or month is outside the planner range.",
                status_code=422,
            )
        tts = _usable_minutes(raw)
        if tts is None:
            continue
        buckets.setdefault((store_id, year, month), []).append(tts)

    if not buckets:
        raise TtsKpiSourceError(
            "AP returned no avg_serve_time_minutes rows for stores below 500.",
            status_code=404,
        )

    rows = tuple(
        TtsKpiPanelRow(
            store_id=store_id,
            year=year,
            month=month,
            tts=round(sum(values) / len(values), 4),
        )
        for (store_id, year, month), values in sorted(buckets.items())
    )
    start = min((row.year, row.month) for row in rows)
    end = max((row.year, row.month) for row in rows)
    return ApTtsKpiPanel(
        period_start=f"{start[0]:04d}-{start[1]:02d}-01",
        period_end=f"{end[0]:04d}-{end[1]:02d}-01",
        reference_year=end[0],
        reference_month=end[1],
        rows=rows,
    )
