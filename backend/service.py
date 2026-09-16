"""Pure sanitization pipeline — no FastAPI / Jupyter dependencies."""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from fraud_guard.stats import network_delta_pp, tier1_drop_reason_counts
from fraud_guard.tier1 import (
    CUSTOMER_BLACKLIST_VALUE,
    FLAG_COL as T1_FLAG,
    REASON_COL as T1_REASON,
    Tier1Config,
    apply_always_topbox_tier,
    apply_blacklist_tier,
    apply_freq_tier,
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
STEP_TIER3 = "tier3"
STEP_TIER4 = "tier4"


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


def _blacklist_tier_config(opts: PipelineConfig) -> Tier1Config:
    return Tier1Config(
        customer_blacklist_value=CUSTOMER_BLACKLIST_VALUE,
        enable_blacklist=True,
    )


def _freq_tier_config(opts: PipelineConfig) -> Tier1Config:
    return Tier1Config(
        enable_freq_store_day=True,
        freq_store_day_min=opts.tier2_freq_threshold,
    )


def _always_topbox_tier_config(opts: PipelineConfig) -> Tier1Config:
    return Tier1Config(
        enable_always_topbox=True,
        always_topbox_min_n=opts.tier3_always_five_min_n,
    )


def _tier4_config(opts: PipelineConfig) -> Tier2Config:
    return Tier2Config(
        min_volume=opts.tier4_min_volume,
        z_high=opts.tier4_z_threshold,
        five_pct_min=opts.tier4_pct_threshold,
    )


def _make_step(
    step_name: str,
    rows_in: int,
    rows_out: int,
    top_box_pct: float,
) -> StepMetric:
    return StepMetric(
        step_name=step_name,  # type: ignore[arg-type]
        rows_in=rows_in,
        rows_out=rows_out,
        rows_dropped=max(rows_in - rows_out, 0),
        top_box_pct=top_box_pct,
    )


def _subtract_cells(
    cells: dict[tuple[float, int, int], tuple[int, int]],
    drops_by_cell: dict[tuple[float, int, int], tuple[int, int]],
) -> dict[tuple[float, int, int], tuple[int, int]]:
    out: dict[tuple[float, int, int], tuple[int, int]] = {}
    for key, (tot, top) in cells.items():
        d_tot, d_top = drops_by_cell.get(key, (0, 0))
        rem_tot = max(tot - d_tot, 0)
        rem_top = max(top - d_top, 0)
        rem_top = min(rem_top, rem_tot)
        out[key] = (rem_tot, rem_top)
    return out


def _cells_totals(cells: dict[tuple[float, int, int], tuple[int, int]]) -> tuple[int, int]:
    volume = sum(v for v, _ in cells.values())
    top_box = sum(t for _, t in cells.values())
    return volume, top_box


def _step_from_cells(
    step_name: str,
    rows_in: int,
    cells: dict[tuple[float, int, int], tuple[int, int]],
) -> StepMetric:
    rows_out, top_out = _cells_totals(cells)
    pct = network_top_box_pct(rows_out, top_out)
    return _make_step(step_name, rows_in, rows_out, pct)


def _apply_row_tier_step(
    current: pd.DataFrame,
    step_name: str,
    *,
    enabled: bool,
    apply_fn,
) -> tuple[pd.DataFrame, StepMetric, dict[str, int]]:
    rows_in = len(current)
    if not enabled or current.empty:
        return current, _make_step(step_name, rows_in, rows_in, _pct(top_box_rate(current))), {}

    flagged = apply_fn(current)
    after = keep_tier1_clean(flagged)
    reasons = tier1_drop_reason_counts(flagged, T1_REASON)
    return after, _make_step(step_name, rows_in, len(after), _pct(top_box_rate(after))), reasons


def _apply_tier4_row_step(
    current: pd.DataFrame,
    config: PipelineConfig,
) -> tuple[pd.DataFrame, StepMetric, list[dict], dict[str, int]]:
    rows_in = len(current)
    if not config.tier4_enabled or current.empty:
        return (
            current,
            _make_step(STEP_TIER4, rows_in, rows_in, _pct(top_box_rate(current))),
            [],
            {},
        )

    t4_cfg = _tier4_config(config)
    panel = build_store_month_panel(current, min_volume=t4_cfg.min_volume)
    high = high_store_months(panel, t4_cfg)
    high_store_months_out = _store_month_cells(panel, high)
    flagged = apply_tier2(current, config=t4_cfg)
    after = keep_tier2_clean(flagged)
    reasons = _reason_counts(flagged, T2_FLAG, T2_REASON)
    return (
        after,
        _make_step(STEP_TIER4, rows_in, len(after), _pct(top_box_rate(after))),
        high_store_months_out,
        reasons,
    )


def _pushdown_row_tier_step(
    working: pd.DataFrame,
    cells: dict[tuple[float, int, int], tuple[int, int]],
    step_name: str,
    rows_in: int,
    *,
    enabled: bool,
    apply_fn,
) -> tuple[pd.DataFrame, dict[tuple[float, int, int], tuple[int, int]], StepMetric, dict[str, int]]:
    if not enabled:
        return working, cells, _step_from_cells(step_name, rows_in, cells), {}

    if working.empty:
        return working, cells, _step_from_cells(step_name, rows_in, cells), {}

    flagged = apply_fn(working)
    dropped = flagged.loc[flagged[T1_FLAG].astype(bool)]
    reasons = tier1_drop_reason_counts(flagged, T1_REASON)
    cells_out = _subtract_cells(cells, _drop_counts_by_cell(dropped))
    working_out = keep_tier1_clean(flagged)
    step = _step_from_cells(step_name, rows_in, cells_out)
    return working_out, cells_out, step, reasons


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
    after_t2: pd.DataFrame,
    after_t3: pd.DataFrame,
    after_t4: pd.DataFrame,
    *,
    store_col: str = "PrintStore",
) -> list[dict]:
    """Monthly actual vs sanitized 5% per store for charting."""
    base_panel = _store_month_panel(baseline, store_col)
    if base_panel.empty:
        return []

    stage_panels = [
        _store_month_panel(stage, store_col)
        for stage in (after_t1, after_t2, after_t3, after_t4)
    ]

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
        stage_pct_vol = [_lookup(panel, store, year, month) for panel in stage_panels]
        final_vol = stage_pct_vol[-1][1]

        series.append(
            StoreImpactPoint(
                store_id=float(store),
                year=year,
                month=month,
                period_label=_period_label(year, month),
                actual_five_pct=round(float(row["five_pct"]), 4),
                after_tier1_five_pct=stage_pct_vol[0][0],
                after_tier2_five_pct=stage_pct_vol[1][0],
                after_tier3_five_pct=stage_pct_vol[2][0],
                after_tier4_five_pct=stage_pct_vol[3][0],
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
    after_t3: dict[tuple[float, int, int], tuple[int, int]],
    after_t4: dict[tuple[float, int, int], tuple[int, int]],
) -> list[dict]:
    series: list[dict] = []
    for key in sorted(baseline_cells.keys()):
        store, year, month = key
        b_vol, b_top = baseline_cells[key]
        stage_cells = (after_t1, after_t2, after_t3, after_t4)
        stage_pct: list[float | None] = []
        for cells in stage_cells:
            vol, top = cells.get(key, (0, 0))
            stage_pct.append(network_top_box_pct(vol, top) if vol else None)
        final_vol, _ = after_t4.get(key, (0, 0))
        series.append(
            StoreImpactPoint(
                store_id=float(store),
                year=year,
                month=month,
                period_label=_period_label(year, month),
                actual_five_pct=network_top_box_pct(b_vol, b_top),
                after_tier1_five_pct=stage_pct[0],
                after_tier2_five_pct=stage_pct[1],
                after_tier3_five_pct=stage_pct[2],
                after_tier4_five_pct=stage_pct[3],
                actual_volume=b_vol,
                final_volume=final_vol,
                rows_dropped=max(b_vol - final_vol, 0),
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
    2. Tiers 1–3 subtract candidate-row drops from Query A store×month cells.
    3. Tier 4 runs on the adjusted aggregate panel (z / pct thresholds).
    4. ``final_top_box_pct`` = remaining top-box / remaining volume after Tier 4.

    ``query_b_mode``:
    - ``blacklist_only`` (VIEW v1): Tier 1 blacklist only on candidates.
    - ``tier1_full`` (snapshot phase 2): tiers 1–3 on Query B candidates.
    """
    baseline_pct = actual_baseline.top_box_pct
    steps: list[StepMetric] = [_actual_step_from_baseline(actual_baseline)]

    baseline_cells: dict[tuple[float, int, int], tuple[int, int]] = {
        _cell_key(a.store_id, a.year, a.month): (a.total_count, a.top_box_count)
        for a in actual_baseline.by_store_period
    }

    raw = _rows_to_frame(candidate_rows)
    answered = filter_answered_metric_rows(raw) if not raw.empty else raw

    tiers_23_on_candidates = query_b_mode == "tier1_full"
    reconciliation = (
        "query_a_minus_tiers_1_3_candidate_drops_then_tier4_on_aggregates"
        if tiers_23_on_candidates
        else "query_a_minus_blacklist_drops_then_tier4_on_aggregates"
    )

    working = answered
    cells = baseline_cells
    rows_in = actual_baseline.total_responses
    drop_reasons: dict[str, dict[str, int]] = {
        STEP_TIER1: {},
        STEP_TIER2: {},
        STEP_TIER3: {},
        STEP_TIER4: {},
    }
    cell_snapshots: list[dict[tuple[float, int, int], tuple[int, int]]] = []

    working, cells, step_t1, drop_reasons[STEP_TIER1] = _pushdown_row_tier_step(
        working,
        cells,
        STEP_TIER1,
        rows_in,
        enabled=config.tier1_blacklist_enabled,
        apply_fn=lambda df: apply_blacklist_tier(df, config=_blacklist_tier_config(config)),
    )
    steps.append(step_t1)
    cell_snapshots.append(dict(cells))
    rows_in = step_t1.rows_out

    working, cells, step_t2, drop_reasons[STEP_TIER2] = _pushdown_row_tier_step(
        working,
        cells,
        STEP_TIER2,
        rows_in,
        enabled=tiers_23_on_candidates and config.tier2_freq_enabled,
        apply_fn=lambda df: apply_freq_tier(df, config=_freq_tier_config(config)),
    )
    steps.append(step_t2)
    cell_snapshots.append(dict(cells))
    rows_in = step_t2.rows_out

    working, cells, step_t3, drop_reasons[STEP_TIER3] = _pushdown_row_tier_step(
        working,
        cells,
        STEP_TIER3,
        rows_in,
        enabled=tiers_23_on_candidates and config.tier3_always_five_enabled,
        apply_fn=lambda df: apply_always_topbox_tier(
            df, config=_always_topbox_tier_config(config)
        ),
    )
    steps.append(step_t3)
    cell_snapshots.append(dict(cells))
    rows_in = step_t3.rows_out

    t4_cfg = _tier4_config(config)
    high_store_months_out: list[dict] = []
    t4_dropped_n = 0
    if config.tier4_enabled:
        panel = _panel_from_cell_map(cells, min_volume=t4_cfg.min_volume)
        high = high_store_months(panel, t4_cfg)
        high_store_months_out = _store_month_cells(panel, high)
        high_keys = (
            {
                _cell_key(float(r["PrintStore"]), int(r["Year"]), int(r["Month"]))
                for _, r in high.iterrows()
            }
            if not high.empty
            else set()
        )
        after_t4_cells: dict[tuple[float, int, int], tuple[int, int]] = {}
        for key, (tot, top) in cells.items():
            if key in high_keys:
                t4_dropped_n += tot
                after_t4_cells[key] = (0, 0)
            else:
                after_t4_cells[key] = (tot, top)
        if t4_dropped_n:
            drop_reasons[STEP_TIER4] = {"high_store_month_z_or_pct": t4_dropped_n}
        cells = after_t4_cells

    step_t4 = _step_from_cells(STEP_TIER4, rows_in, cells)
    steps.append(step_t4)
    cell_snapshots.append(dict(cells))

    store_series = _impact_from_cell_maps(
        baseline_cells,
        cell_snapshots[0],
        cell_snapshots[1],
        cell_snapshots[2],
        cell_snapshots[3],
    )
    final_pct = step_t4.top_box_pct
    delta = network_delta_pp(final_pct, baseline_pct)
    tiers_123_dropped = sum(s.rows_dropped for s in steps[1:4])

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
            "drop_reasons": drop_reasons,
            "actual_source": "query_a",
            "query_b_mode": query_b_mode,
            "reconciliation": reconciliation,
            "actual_total_responses": actual_baseline.total_responses,
            "actual_top_box_count": actual_baseline.top_box_count,
            "tiers_123_dropped_rows": tiers_123_dropped,
        },
    )


def run_pipeline(
    request: ProcessRequest,
    *,
    actual_baseline: ActualBaseline | None = None,
) -> SanitizationResponse:
    """Execute actual → tier1 → tier2 → tier3 → tier4 and return aggregate KPI metrics.

    When ``actual_baseline`` is provided (Query A pushdown), the ``actual`` step
    and ``baseline_top_box_pct`` come from SQL aggregates — not from scanning a
    raw-row DataFrame. Tiers 1–4 still run on ``request.rows`` (Query B).
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
    drop_reasons: dict[str, dict[str, int]] = {
        STEP_TIER1: {},
        STEP_TIER2: {},
        STEP_TIER3: {},
        STEP_TIER4: {},
    }

    current, step_t1, drop_reasons[STEP_TIER1] = _apply_row_tier_step(
        current,
        STEP_TIER1,
        enabled=config.tier1_blacklist_enabled,
        apply_fn=lambda df: apply_blacklist_tier(df, config=_blacklist_tier_config(config)),
    )
    steps.append(step_t1)
    after_t1 = current

    current, step_t2, drop_reasons[STEP_TIER2] = _apply_row_tier_step(
        current,
        STEP_TIER2,
        enabled=config.tier2_freq_enabled,
        apply_fn=lambda df: apply_freq_tier(df, config=_freq_tier_config(config)),
    )
    steps.append(step_t2)
    after_t2 = current

    current, step_t3, drop_reasons[STEP_TIER3] = _apply_row_tier_step(
        current,
        STEP_TIER3,
        enabled=config.tier3_always_five_enabled,
        apply_fn=lambda df: apply_always_topbox_tier(
            df, config=_always_topbox_tier_config(config)
        ),
    )
    steps.append(step_t3)
    after_t3 = current

    current, step_t4, high_store_months_out, drop_reasons[STEP_TIER4] = _apply_tier4_row_step(
        current, config
    )
    steps.append(step_t4)
    after_t4 = current

    store_series = _build_store_impact_series(answered, after_t1, after_t2, after_t3, after_t4)

    final_pct = step_t4.top_box_pct
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
            "drop_reasons": drop_reasons,
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
