"""TTS sanitization pipeline: actual → ge30 (+ optional order_agg).

Stage 2 lock: apply ``TTS_sec >= tts_min_sec`` on **bump rows**, then optionally
collapse to order grain with avg/max (``order_agg``). Order collapse does not
replace the ge30 filter (SPEC-tts Invariant T3).
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from schemas.tts import (
    TtsPipelineConfig,
    TtsSanitizationResult,
    TtsStepMetric,
    TtsStoreImpactPoint,
)
from tts_guard.clock import (
    COL_BUMP,
    COL_SALE_DATE,
    COL_STORE,
    COL_UP,
    COL_WEBORDER,
    TTS_SEC_COL,
    attach_tts_sec,
    order_key_frame,
    valid_tts_mask,
)


def _round4(value: float) -> float:
    return round(float(value), 4)


def _mean_tts(series: pd.Series) -> float:
    if series.empty:
        return 0.0
    return _round4(float(series.mean()))


def _median_tts(series: pd.Series) -> float | None:
    if series.empty:
        return None
    return _round4(float(series.median()))


def _step_metric(
    name: str,
    rows_in: int,
    frame: pd.DataFrame,
) -> TtsStepMetric:
    series = frame[TTS_SEC_COL] if not frame.empty else pd.Series(dtype=float)
    rows_out = int(len(frame))
    return TtsStepMetric(
        step_name=name,  # type: ignore[arg-type]
        rows_in=rows_in,
        rows_out=rows_out,
        rows_dropped=max(0, rows_in - rows_out),
        mean_tts_sec=_mean_tts(series),
        median_tts_sec=_median_tts(series),
    )


def _year_month(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    sale = pd.to_datetime(df[COL_SALE_DATE], errors="coerce")
    return sale.dt.year.astype("Int64"), sale.dt.month.astype("Int64")


def _store_month_means(df: pd.DataFrame) -> dict[tuple[int, int, int], tuple[float, int]]:
    """Map (store, year, month) → (mean_tts_sec, volume)."""
    if df.empty:
        return {}
    work = df.copy()
    work["_year"], work["_month"] = _year_month(work)
    work = work.dropna(subset=["_year", "_month", COL_STORE, TTS_SEC_COL])
    out: dict[tuple[int, int, int], tuple[float, int]] = {}
    grouped = work.groupby([COL_STORE, "_year", "_month"], dropna=False)
    for (store, year, month), grp in grouped:
        out[(int(store), int(year), int(month))] = (
            _mean_tts(grp[TTS_SEC_COL]),
            int(len(grp)),
        )
    return out


def _collapse_orders(df: pd.DataFrame, how: str) -> pd.DataFrame:
    """One row per order; tts_sec = mean or max of bumps."""
    if df.empty:
        return df.copy()
    work = df.copy()
    work["_order_key"] = order_key_frame(work)
    work["_year"], work["_month"] = _year_month(work)
    if how == "avg":
        agg_tts = work.groupby("_order_key", sort=False)[TTS_SEC_COL].mean()
    elif how == "max":
        agg_tts = work.groupby("_order_key", sort=False)[TTS_SEC_COL].max()
    else:
        raise ValueError(f"unsupported order_agg={how!r}")

    # Keep store / sale month from first bump of each order.
    first = work.groupby("_order_key", sort=False).first()
    collapsed = first[[COL_STORE, COL_SALE_DATE, COL_WEBORDER]].copy()
    collapsed[TTS_SEC_COL] = agg_tts.reindex(collapsed.index).to_numpy()
    # Preserve Up/Bump only for schema familiarity (not used after collapse).
    if COL_UP in first.columns:
        collapsed[COL_UP] = first[COL_UP]
    if COL_BUMP in first.columns:
        collapsed[COL_BUMP] = first[COL_BUMP]
    return collapsed.reset_index(drop=True)


def _build_store_impact(
    before: pd.DataFrame,
    after: pd.DataFrame,
) -> list[TtsStoreImpactPoint]:
    before_map = _store_month_means(before)
    after_map = _store_month_means(after)
    keys = sorted(set(before_map) | set(after_map))
    points: list[TtsStoreImpactPoint] = []
    for store_id, year, month in keys:
        b = before_map.get((store_id, year, month))
        a = after_map.get((store_id, year, month))
        points.append(
            TtsStoreImpactPoint(
                store_id=store_id,
                year=year,
                month=month,
                actual_mean_tts_sec=None if b is None else b[0],
                after_ge30_mean_tts_sec=None if a is None else a[0],
                volume_before=None if b is None else b[1],
                volume_after=None if a is None else a[1],
            )
        )
    return points


def run_tts_sanitize(
    df: pd.DataFrame,
    config: TtsPipelineConfig | None = None,
) -> TtsSanitizationResult:
    """Run actual → ge30 (bump), then optional order_agg for final KPI / series.

    Input columns (McKitiBump): StoreIndex, SaleDate, WeborderID, UpDatetime,
    BumpDateTime. Extra columns are ignored.
    """
    cfg = config if config is not None else TtsPipelineConfig()
    prepared = attach_tts_sec(df)
    actual = prepared.loc[valid_tts_mask(prepared)].copy()
    rows_actual = int(len(actual))

    step_actual = _step_metric("actual", rows_actual, actual)

    ge30 = actual.loc[actual[TTS_SEC_COL] >= float(cfg.tts_min_sec)].copy()
    step_ge30 = _step_metric("ge30", rows_actual, ge30)

    meta: dict[str, Any] = {
        "tts_min_sec": cfg.tts_min_sec,
        "order_agg": cfg.order_agg,
        "order_agg_applied_after_ge30": cfg.order_agg != "none",
        "grain_final": "bump" if cfg.order_agg == "none" else "order",
        "input_rows": int(len(df)),
        "valid_tts_rows": rows_actual,
        "negatives_before_ge30": int((actual[TTS_SEC_COL] < 0).sum()) if rows_actual else 0,
        "negatives_after_ge30": int((ge30[TTS_SEC_COL] < 0).sum()) if len(ge30) else 0,
    }

    if cfg.order_agg == "none":
        final_frame = ge30
    else:
        final_frame = _collapse_orders(ge30, cfg.order_agg)

    baseline = step_actual.mean_tts_sec
    final_mean = _mean_tts(final_frame[TTS_SEC_COL]) if len(final_frame) else 0.0
    # Store impact: before = bump actual; after = final grain (bump ge30 or orders).
    series = _build_store_impact(actual, final_frame)

    return TtsSanitizationResult(
        baseline_mean_tts_sec=baseline,
        final_mean_tts_sec=final_mean,
        network_delta_sec=_round4(final_mean - baseline),
        steps=[step_actual, step_ge30],
        store_impact_series=series,
        echo_config=cfg,
        meta=meta,
    )
