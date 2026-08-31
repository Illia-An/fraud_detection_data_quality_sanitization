"""Tier 2: store×month z-score / high top-box rate filtering.

Experiment-backed rule (after Tier 1 MVP):
flag answers belonging to store-months with z > 2 OR five_pct >= 90
(volume >= 30). Classic z > 3 upward is ineffective when mean+3σ > 100.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from fraud_guard.features import ColumnMapping
from fraud_guard.tier1 import RATE_GET_ANSWERS_MAPPING, TOP_BOX_VALUE

FLAG_COL = "fraud_tier2_flag"
REASON_COL = "fraud_tier2_reasons"
REASON_HIGH_STORE_MONTH = "high_store_month_z_or_pct"


@dataclass(frozen=True)
class Tier2Config:
    """Thresholds for store-month anomaly flags."""

    min_volume: int = 30
    z_high: float = 2.0
    five_pct_min: float = 90.0
    top_box_value: int = TOP_BOX_VALUE


def build_store_month_panel(
    df: pd.DataFrame,
    mapping: ColumnMapping = RATE_GET_ANSWERS_MAPPING,
    *,
    min_volume: int = 30,
    top_box_value: int = TOP_BOX_VALUE,
) -> pd.DataFrame:
    """Aggregate answered rows to PrintStore × Year × Month with five_pct and z."""
    store_col = mapping.store_id
    answer_col = mapping.answer_value
    if not store_col or not answer_col:
        raise ValueError("mapping.store_id and mapping.answer_value are required")
    for col in ("Year", "Month", store_col, answer_col):
        if col not in df.columns:
            raise ValueError(f"missing column for panel: {col}")

    def five_pct(s: pd.Series) -> float:
        return 100.0 * float((s == top_box_value).mean())

    panel = (
        df.groupby([store_col, "Year", "Month"], dropna=False)[answer_col]
        .agg(volume="count", five_pct=five_pct)
        .reset_index()
    )
    panel = panel[panel["volume"] >= min_volume].copy()
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


def high_store_months(
    panel: pd.DataFrame,
    config: Tier2Config | None = None,
) -> pd.DataFrame:
    """Store-months flagged as high outliers."""
    config = config or Tier2Config()
    if panel.empty:
        return panel.copy()
    mask = (panel["z"] > config.z_high) | (panel["five_pct"] >= config.five_pct_min)
    return panel.loc[mask].copy()


def apply_tier2(
    df: pd.DataFrame,
    mapping: ColumnMapping | None = None,
    config: Tier2Config | None = None,
) -> pd.DataFrame:
    """Flag rows that belong to high store-months (does not drop rows)."""
    mapping = mapping or RATE_GET_ANSWERS_MAPPING
    config = config or Tier2Config()
    out = df.copy()
    out[FLAG_COL] = False
    out[REASON_COL] = ""

    store_col = mapping.store_id
    if not store_col or store_col not in out.columns:
        return out

    panel = build_store_month_panel(
        out,
        mapping,
        min_volume=config.min_volume,
        top_box_value=config.top_box_value,
    )
    high = high_store_months(panel, config)
    if high.empty:
        return out

    high_keys = set(
        zip(high[store_col], high["Year"], high["Month"], strict=True)
    )
    keys = list(zip(out[store_col], out["Year"], out["Month"], strict=True))
    bad = pd.Series([k in high_keys for k in keys], index=out.index)
    out.loc[bad, FLAG_COL] = True
    out.loc[bad, REASON_COL] = REASON_HIGH_STORE_MONTH
    return out


def keep_clean_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Rows not flagged by Tier 2."""
    if FLAG_COL not in df.columns:
        return df.copy()
    return df.loc[~df[FLAG_COL].astype(bool)].copy()
