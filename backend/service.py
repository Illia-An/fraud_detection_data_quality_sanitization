"""Pure sanitization pipeline — no FastAPI / Jupyter dependencies."""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from fraud_guard.stats import filter_stats, network_delta_pp, tier1_drop_reason_counts
from fraud_guard.tier1 import (
    FLAG_COL as T1_FLAG,
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

from backend.queries import ActualBaseline, network_top_box_pct
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
        enable_freq_store_day=opts.tier1_freq_enabled,
        enable_always_topbox=opts.tier1_always_five_enabled,
        freq_store_day_min=opts.tier1_freq_threshold,
        always_topbox_min_n=opts.tier1_always_five_min_n,
    )


def _tier1_config_blacklist_only(opts: PipelineConfig) -> Tier1Config:
    """Query B v1 loads blacklist rows only — do not apply freq/always-5 here."""
    return Tier1Config(
        enable_blacklist=opts.tier1_blacklist_enabled,
        enable_freq_store_day=False,
        enable_always_topbox=False,
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


def _cell_key(store_id: float, year: int, month: int) -> tuple[float, int, int]:
    return (float(store_id), int(year), int(month))


def _drop_counts_by_cell(dropped: pd.DataFrame) -> dict[tuple[float, int, int], tuple[int, int]]:
    """Return (total_dropped, top_box_dropped) per store×year×month."""
    out: dict[tuple[float, int, int], list[int]] = {}
    if dropped.empty:
        return {}
    for _, row in dropped.iterrows():
        store = row.get("PrintStore")
        year = row.get("Year")
        month = row.get("Month")
        if store is None or year is None or month is None or (isinstance(year, float) and pd.isna(year)):
            continue
        key = _cell_key(float(store), int(year), int(month))
        bucket = out.setdefault(key, [0, 0])
        bucket[0] += 1
        answer = row.get("Answer_Value")
        if answer == 5 or (isinstance(answer, (int, float)) and int(answer) == 5):
            bucket[1] += 1
    return {k: (v[0], v[1]) for k, v in out.items()}


def _panel_from_cell_map(
    cells: dict[tuple[float, int, int], tuple[int, int]],
    *,
    min_volume: int,
) -> pd.DataFrame:
    """Build Tier2-style panel from (volume, top_box_count) cell map."""
    rows: list[dict] = []
    for (store, year, month), (volume, top_box) in cells.items():
        if volume < min_volume:
            continue
        five_pct = 100.0 * top_box / volume if volume else 0.0
        rows.append(
            {
                "PrintStore": store,
                "Year": year,
                "Month": month,
                "volume": volume,
                "five_pct": five_pct,
            }
        )
    panel = pd.DataFrame(rows)
    if panel.empty:
        panel["z"] = pd.Series(dtype=float)
        return panel
    mu = float(panel["five_pct"].mean())
    sigma = float(panel["five_pct"].std(ddof=0))
    if sigma == 0:
        panel["z"] = 0.0
    else:
        panel["z"] = (panel["five_pct"] - mu) / sigma
    return panel


def _impact_from_cell_maps(
    baseline_cells: dict[tuple[float, int, int], tuple[int, int]],
    after_t1: dict[tuple[float, int, int], tuple[int, int]],
    after_t2: dict[tuple[float, int, int], tuple[int, int]],
) -> list[dict]:
    series: list[dict] = []
    for key in sorted(baseline_cells.keys()):
        store, year, month = key
        b_vol, b_top = baseline_cells[key]
        t1_vol, t1_top = after_t1.get(key, (0, 0))
        t2_vol, t2_top = after_t2.get(key, (0, 0))
        actual_pct = network_top_box_pct(b_vol, b_top)
        t1_pct = network_top_box_pct(t1_vol, t1_top) if t1_vol else None
        t2_pct = network_top_box_pct(t2_vol, t2_top) if t2_vol else None
        series.append(
            StoreImpactPoint(
                store_id=float(store),
                year=year,
                month=month,
                period_label=_period_label(year, month),
                actual_five_pct=actual_pct,
                after_tier1_five_pct=t1_pct,
                after_tier2_five_pct=t2_pct,
                actual_volume=b_vol,
                final_volume=t2_vol,
                rows_dropped=max(b_vol - t2_vol, 0),
            ).model_dump(mode="python")
        )
    return series


def _actual_step_from_baseline(baseline: ActualBaseline) -> StepMetric:
    """Build the ``actual`` step solely from Query A aggregates (no raw DF)."""
    return StepMetric(
        step_name=STEP_ACTUAL,
        rows_in=baseline.total_responses,
        rows_out=baseline.total_responses,
        rows_dropped=0,
        top_box_pct=baseline.top_box_pct,
    )


def run_pipeline_pushdown(
    actual_baseline: ActualBaseline,
    candidate_rows: list[SurveyAnswerRow],
    config: PipelineConfig,
    *,
    query_b_mode: str = "blacklist_only",
) -> SanitizationResponse:
    """Query A + Query B reconciliation path (SPEC §5.2).

    Reconciliation method:
    1. ``actual`` / baseline from Query A aggregates (no raw period DF).
    2. Tier 1 flags applied only to Query B candidate rows; drop counts
       (total + top-box) are subtracted from Query A store×month cells.
    3. Tier 2 runs on the adjusted aggregate panel (z / pct thresholds) —
       equivalent to loading outlier store-months without a full raw scan.
    4. ``final_top_box_pct`` = remaining top-box / remaining volume after Tier 2.

    ``query_b_mode``:
    - ``blacklist_only`` (VIEW v1): Tier1 blacklist rule only on candidates.
    - ``tier1_full`` (snapshot phase 2): full Tier1 (blacklist + freq + always-5).
    """
    baseline_pct = actual_baseline.top_box_pct
    steps: list[StepMetric] = [_actual_step_from_baseline(actual_baseline)]

    baseline_cells: dict[tuple[float, int, int], tuple[int, int]] = {
        _cell_key(a.store_id, a.year, a.month): (a.total_count, a.top_box_count)
        for a in actual_baseline.by_store_period
    }

    raw = _rows_to_frame(candidate_rows)
    answered = filter_answered_metric_rows(raw) if not raw.empty else raw

    if query_b_mode == "tier1_full":
        t1_cfg = _tier1_config(config)
        reconciliation = "query_a_minus_tier1_candidate_drops_then_tier2_on_aggregates"
    else:
        t1_cfg = _tier1_config_blacklist_only(config)
        reconciliation = "query_a_minus_blacklist_drops_then_tier2_on_aggregates"
    t2_cfg = _tier2_config(config)

    drop_reasons_t1: dict[str, int] = {}
    t1_dropped_n = 0
    t1_dropped_top = 0
    t1_drops_by_cell: dict[tuple[float, int, int], tuple[int, int]] = {}

    if not answered.empty:
        flagged_t1 = apply_tier1(answered, config=t1_cfg)
        dropped_t1 = flagged_t1.loc[flagged_t1[T1_FLAG].astype(bool)]
        drop_reasons_t1 = tier1_drop_reason_counts(flagged_t1, T1_REASON)
        t1_drops_by_cell = _drop_counts_by_cell(dropped_t1)
        t1_dropped_n = int(len(dropped_t1))
        t1_dropped_top = (
            int((dropped_t1["Answer_Value"] == 5).sum()) if not dropped_t1.empty else 0
        )

    after_t1_cells: dict[tuple[float, int, int], tuple[int, int]] = {}
    for key, (tot, top) in baseline_cells.items():
        d_tot, d_top = t1_drops_by_cell.get(key, (0, 0))
        rem_tot = max(tot - d_tot, 0)
        rem_top = max(top - d_top, 0)
        rem_top = min(rem_top, rem_tot)
        after_t1_cells[key] = (rem_tot, rem_top)

    n_after_t1 = sum(v for v, _ in after_t1_cells.values())
    top_after_t1 = sum(t for _, t in after_t1_cells.values())
    t1_pct = network_top_box_pct(n_after_t1, top_after_t1)

    steps.append(
        StepMetric(
            step_name=STEP_TIER1,
            rows_in=actual_baseline.total_responses,
            rows_out=n_after_t1,
            rows_dropped=max(actual_baseline.total_responses - n_after_t1, 0),
            top_box_pct=t1_pct,
        )
    )

    panel = _panel_from_cell_map(after_t1_cells, min_volume=t2_cfg.min_volume)
    high = high_store_months(panel, t2_cfg)
    high_store_months_out = _store_month_cells(panel, high)
    high_keys = (
        {
            _cell_key(float(r["PrintStore"]), int(r["Year"]), int(r["Month"]))
            for _, r in high.iterrows()
        }
        if not high.empty
        else set()
    )

    after_t2_cells: dict[tuple[float, int, int], tuple[int, int]] = {}
    t2_dropped_n = 0
    for key, (tot, top) in after_t1_cells.items():
        if key in high_keys:
            t2_dropped_n += tot
            after_t2_cells[key] = (0, 0)
        else:
            after_t2_cells[key] = (tot, top)

    n_final = sum(v for v, _ in after_t2_cells.values())
    top_final = sum(t for _, t in after_t2_cells.values())
    final_pct = network_top_box_pct(n_final, top_final)

    steps.append(
        StepMetric(
            step_name=STEP_TIER2,
            rows_in=n_after_t1,
            rows_out=n_final,
            rows_dropped=max(n_after_t1 - n_final, 0),
            top_box_pct=final_pct,
        )
    )

    store_series = _impact_from_cell_maps(baseline_cells, after_t1_cells, after_t2_cells)
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
            "input_rows": len(candidate_rows),
            "answered_rows": 0 if answered.empty else len(answered),
            "drop_reasons": {
                "tier1": drop_reasons_t1,
                "tier2": {"high_store_month_z_or_pct": t2_dropped_n} if t2_dropped_n else {},
            },
            "actual_source": "query_a",
            "query_b_mode": query_b_mode,
            "reconciliation": reconciliation,
            "actual_total_responses": actual_baseline.total_responses,
            "actual_top_box_count": actual_baseline.top_box_count,
            "tier1_dropped_rows": t1_dropped_n,
            "tier1_dropped_top_box": t1_dropped_top,
        },
    )


def run_pipeline(
    request: ProcessRequest,
    *,
    actual_baseline: ActualBaseline | None = None,
) -> SanitizationResponse:
    """Execute Tier1 → Tier2 and return aggregate KPI metrics.

    When ``actual_baseline`` is provided (Query A pushdown), the ``actual`` step
    and ``baseline_top_box_pct`` come from SQL aggregates — not from scanning a
    raw-row DataFrame. Tier1/Tier2 still run on ``request.rows`` (Query B).
    """
    config = request.config
    raw = _rows_to_frame(request.rows)
    answered = filter_answered_metric_rows(raw)

    if answered.empty and actual_baseline is None:
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
    if actual_baseline is not None:
        baseline_pct = actual_baseline.top_box_pct
        steps.append(_actual_step_from_baseline(actual_baseline))
    else:
        baseline = top_box_rate(answered)
        baseline_pct = _pct(baseline)
        steps.append(
            StepMetric(
                step_name=STEP_ACTUAL,
                rows_in=len(raw),
                rows_out=len(answered),
                rows_dropped=len(raw) - len(answered),
                top_box_pct=baseline_pct,
            )
        )

    if answered.empty:
        # Query A had data but Query B returned nothing usable — surface actual only.
        return SanitizationResponse(
            baseline_top_box_pct=baseline_pct,
            final_top_box_pct=baseline_pct,
            network_delta_pp=0.0,
            steps=steps,
            high_store_months=[],
            store_impact_series=[],
            echo_config=config,
            meta={
                "processed_at": datetime.now(UTC).isoformat(),
                "input_rows": len(raw),
                "answered_rows": 0,
                "actual_source": "query_a",
            },
        )

    current = answered

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
            "actual_source": "query_a" if actual_baseline is not None else "inline",
            "actual_total_responses": (
                actual_baseline.total_responses if actual_baseline is not None else len(answered)
            ),
            "actual_top_box_count": (
                actual_baseline.top_box_count
                if actual_baseline is not None
                else int((answered["Answer_Value"] == 5).sum())
                if "Answer_Value" in answered.columns
                else 0
            ),
        },
    )
