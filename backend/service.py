"""Pure sanitization pipeline — no FastAPI / Jupyter dependencies."""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from fraud_guard.stats import filter_stats, network_delta_pp, tier1_drop_reason_counts
from fraud_guard.tier1 import (
    REASON_COL as T1_REASON,
    Tier1Config,
    apply_tier1,
    filter_answered_metric_rows,
    keep_clean_rows as keep_tier1_clean,
    top_box_rate,
)
from fraud_guard.tier2 import (
    FLAG_COL as T2_FLAG,
    REASON_COL as T2_REASON,
    Tier2Config,
    apply_tier2,
    build_store_month_panel,
    high_store_months,
    keep_clean_rows as keep_tier2_clean,
)

from backend.schemas import (
    PipelineConfig,
    ProcessRequest,
    SanitizationResponse,
    StepMetric,
    StoreImpactPoint,
    StoreMonthCell,
    SurveyAnswerRow,
)

STEP_ACTUAL = "actual"
STEP_TIER1 = "tier1"
STEP_TIER2 = "tier2"


def _rows_to_frame(rows: list[SurveyAnswerRow]) -> pd.DataFrame:
    records = [row.model_dump(mode="python") for row in rows]
    df = pd.DataFrame(records)
    _ensure_year_month(df)
    return df


def _ensure_year_month(df: pd.DataFrame) -> None:
    """Derive Year/Month from AnswerTime when missing."""
    if "AnswerTime" not in df.columns:
        return
    ts = pd.to_datetime(df["AnswerTime"], errors="coerce")
    if "Year" not in df.columns:
        df["Year"] = ts.dt.year
    else:
        df["Year"] = df["Year"].fillna(ts.dt.year)
    if "Month" not in df.columns:
        df["Month"] = ts.dt.month
    else:
        df["Month"] = df["Month"].fillna(ts.dt.month)


def _tier1_config(opts: PipelineConfig) -> Tier1Config:
    return Tier1Config(
        enable_blacklist=opts.tier1_blacklist_enabled,
        enable_freq_store_day=True,
        enable_always_topbox=opts.tier1_always_five_enabled,
        freq_store_day_min=opts.tier1_freq_threshold,
        always_topbox_min_n=opts.tier1_always_five_min_n,
    )


def _tier2_config(opts: PipelineConfig) -> Tier2Config:
    return Tier2Config(
        min_volume=opts.tier2_min_volume,
        z_high=opts.tier2_z_threshold,
        five_pct_min=opts.tier2_pct_threshold,
    )


def _pct(rate: float) -> float:
    if rate != rate:  # NaN
        return 0.0
    return round(rate * 100.0, 4)


def _reason_counts(flagged: pd.DataFrame, flag_col: str, reason_col: str) -> dict[str, int]:
    if flag_col not in flagged.columns or reason_col not in flagged.columns:
        return {}
    dropped = flagged.loc[flagged[flag_col].astype(bool), reason_col].fillna("")
    counts: dict[str, int] = {}
    for cell in dropped:
        for reason in str(cell).split(","):
            key = reason.strip()
            if key:
                counts[key] = counts.get(key, 0) + 1
    return counts


def _store_month_cells(
    panel: pd.DataFrame,
    high: pd.DataFrame,
    store_col: str = "PrintStore",
) -> list[dict]:
    if panel.empty:
        return []
    high_keys = (
        set(zip(high[store_col], high["Year"], high["Month"], strict=True))
        if not high.empty
        else set()
    )
    cells: list[dict] = []
    for _, row in panel.iterrows():
        key = (row[store_col], row["Year"], row["Month"])
        cells.append(
            StoreMonthCell(
                store_id=float(row[store_col]),
                year=int(row["Year"]),
                month=int(row["Month"]),
                volume=int(row["volume"]),
                five_pct=round(float(row["five_pct"]), 4),
                z=round(float(row["z"]), 4),
                flagged=key in high_keys,
            ).model_dump(mode="python")
        )
    return cells


def _store_month_panel(df: pd.DataFrame, store_col: str = "PrintStore") -> pd.DataFrame:
    """Five_pct and volume per store × year × month."""
    if df.empty or store_col not in df.columns:
        return pd.DataFrame(columns=[store_col, "Year", "Month", "volume", "five_pct"])

    def five_pct(s: pd.Series) -> float:
        return 100.0 * float((s == 5).mean())

    panel = (
        df.groupby([store_col, "Year", "Month"], dropna=False)["Answer_Value"]
        .agg(volume="count", five_pct=five_pct)
        .reset_index()
    )
    return panel


def _period_label(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def _build_store_impact_series(
    baseline: pd.DataFrame,
    after_t1: pd.DataFrame,
    after_t2: pd.DataFrame | None,
    *,
    store_col: str = "PrintStore",
) -> list[dict]:
    """Monthly actual vs sanitized 5% per store for charting."""
    base_panel = _store_month_panel(baseline, store_col)
    if base_panel.empty:
        return []

    t1_panel = _store_month_panel(after_t1, store_col)
    t2_panel = _store_month_panel(after_t2, store_col) if after_t2 is not None else None

    def _lookup(panel: pd.DataFrame | None, store, year, month) -> tuple[float | None, int]:
        if panel is None or panel.empty:
            return None, 0
        hit = panel[
            (panel[store_col] == store) & (panel["Year"] == year) & (panel["Month"] == month)
        ]
        if hit.empty:
            return None, 0
        row = hit.iloc[0]
        return round(float(row["five_pct"]), 4), int(row["volume"])

    series: list[dict] = []
    for _, row in base_panel.sort_values([store_col, "Year", "Month"]).iterrows():
        store = row[store_col]
        year = int(row["Year"])
        month = int(row["Month"])
        actual_vol = int(row["volume"])
        t1_pct, t1_vol = _lookup(t1_panel, store, year, month)
        t2_pct, t2_vol = _lookup(t2_panel, store, year, month)

        final_vol = t2_vol if after_t2 is not None else t1_vol

        series.append(
            StoreImpactPoint(
                store_id=float(store),
                year=year,
                month=month,
                period_label=_period_label(year, month),
                actual_five_pct=round(float(row["five_pct"]), 4),
                after_tier1_five_pct=t1_pct,
                after_tier2_five_pct=t2_pct,
                actual_volume=actual_vol,
                final_volume=final_vol,
                rows_dropped=max(actual_vol - final_vol, 0),
            ).model_dump(mode="python")
        )
    return series


def run_pipeline(request: ProcessRequest) -> SanitizationResponse:
    """Execute Tier1 → Tier2 and return aggregate KPI metrics."""
    config = request.config
    raw = _rows_to_frame(request.rows)
    answered = filter_answered_metric_rows(raw)

    if answered.empty:
        return SanitizationResponse(
            baseline_top_box_pct=0.0,
            final_top_box_pct=0.0,
            network_delta_pp=0.0,
            steps=[
                StepMetric(
                    step_name=STEP_ACTUAL,
                    rows_in=len(raw),
                    rows_out=0,
                    rows_dropped=len(raw),
                    top_box_pct=0.0,
                )
            ],
            high_store_months=[],
            store_impact_series=[],
            echo_config=config,
            meta={"processed_at": datetime.now(UTC).isoformat()},
        )

    steps: list[StepMetric] = []
    baseline = top_box_rate(answered)
    current = answered
    baseline_pct = _pct(baseline)

    steps.append(
        StepMetric(
            step_name=STEP_ACTUAL,
            rows_in=len(raw),
            rows_out=len(current),
            rows_dropped=len(raw) - len(current),
            top_box_pct=baseline_pct,
        )
    )

    # Tier 1
    t1_cfg = _tier1_config(config)
    flagged_t1 = apply_tier1(current, config=t1_cfg)
    after_t1 = keep_tier1_clean(flagged_t1)
    t1_stats = filter_stats(current, after_t1)
    steps.append(
        StepMetric(
            step_name=STEP_TIER1,
            rows_in=t1_stats.rows_read,
            rows_out=t1_stats.rows_kept,
            rows_dropped=t1_stats.rows_dropped,
            top_box_pct=_pct(top_box_rate(after_t1)),
        )
    )
    current = after_t1
    drop_reasons_t1 = tier1_drop_reason_counts(flagged_t1, T1_REASON)

    # Tier 2 (always on — thresholds come from PipelineConfig)
    t2_cfg = _tier2_config(config)
    panel = build_store_month_panel(current, min_volume=t2_cfg.min_volume)
    high = high_store_months(panel, t2_cfg)
    high_store_months_out = _store_month_cells(panel, high)

    flagged_t2 = apply_tier2(current, config=t2_cfg)
    after_t2 = keep_tier2_clean(flagged_t2)
    t2_stats = filter_stats(current, after_t2)
    steps.append(
        StepMetric(
            step_name=STEP_TIER2,
            rows_in=t2_stats.rows_read,
            rows_out=t2_stats.rows_kept,
            rows_dropped=t2_stats.rows_dropped,
            top_box_pct=_pct(top_box_rate(after_t2)),
        )
    )
    drop_reasons_t2 = _reason_counts(flagged_t2, T2_FLAG, T2_REASON)
    current = after_t2

    store_series = _build_store_impact_series(answered, after_t1, after_t2)

    final_pct = _pct(top_box_rate(current))
    delta = network_delta_pp(final_pct, baseline_pct)

    return SanitizationResponse(
        baseline_top_box_pct=baseline_pct,
        final_top_box_pct=final_pct,
        network_delta_pp=delta,
        steps=steps,
        high_store_months=high_store_months_out,
        store_impact_series=store_series,
        echo_config=config,
        meta={
            "processed_at": datetime.now(UTC).isoformat(),
            "input_rows": len(raw),
            "answered_rows": len(answered),
            "drop_reasons": {"tier1": drop_reasons_t1, "tier2": drop_reasons_t2},
        },
    )
