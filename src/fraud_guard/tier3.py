"""Tier 3: IsolationForest on entity-level features (after Tier 1/2).

Experiment-backed rule (SummerCampain, post Tier1+Tier2):
- Aggregate entity profiles (n >= min_entity_n)
- Flag anomalies via sklearn IsolationForest
- Drop all rows for flagged entities

Default contamination=0.005 from notebook sweep (modest KPI lift, fewer rows).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from fraud_guard.features import ColumnMapping
from fraud_guard.tier1 import ENTITY_COL, RATE_GET_ANSWERS_MAPPING, build_entity_key

FLAG_COL = "fraud_tier3_flag"
REASON_COL = "fraud_tier3_reasons"
REASON_IF_ANOMALY = "isolation_forest_entity"

FEATURE_COLS = (
    "n_answers",
    "topbox_rate",
    "score_variance",
    "latency_median_min",
    "latency_std_min",
    "n_stores",
    "max_answers_store_day",
    "n_store_days",
)


@dataclass(frozen=True)
class Tier3Config:
    """Thresholds for entity-level IsolationForest flags."""

    contamination: float = 0.005
    min_entity_n: int = 3
    n_estimators: int = 200
    random_state: int = 42


def build_entity_feature_table(
    df: pd.DataFrame,
    mapping: ColumnMapping = RATE_GET_ANSWERS_MAPPING,
    *,
    min_entity_n: int = 3,
) -> pd.DataFrame:
    """Entity × feature table for IsolationForest (only entities with n >= min_entity_n)."""
    store_col = mapping.store_id
    answer_col = mapping.answer_value
    event_ts = mapping.event_ts
    checkout_ts = mapping.checkout_ts
    if not store_col or not answer_col or not event_ts:
        raise ValueError("mapping.store_id, answer_value, event_ts are required")

    work = df.copy()
    if ENTITY_COL not in work.columns:
        work[ENTITY_COL] = build_entity_key(work, mapping)
    work = work[work[ENTITY_COL].notna()].copy()

    if checkout_ts and checkout_ts in work.columns:
        work["latency_min"] = (
            pd.to_datetime(work[event_ts], errors="coerce")
            - pd.to_datetime(work[checkout_ts], errors="coerce")
        ).dt.total_seconds() / 60.0
    else:
        work["latency_min"] = np.nan

    work["answer_day"] = pd.to_datetime(work[event_ts], errors="coerce").dt.date
    work["is_topbox"] = work[answer_col].eq(5).astype(int)

    grouped = work.groupby(ENTITY_COL, sort=False)
    feat = grouped.agg(
        n_answers=(answer_col, "count"),
        topbox_rate=("is_topbox", "mean"),
        score_variance=(answer_col, "var"),
        latency_median_min=("latency_min", "median"),
        latency_std_min=("latency_min", "std"),
        n_stores=(store_col, "nunique"),
    ).reset_index()

    store_day_cnt = (
        work.groupby([ENTITY_COL, store_col, "answer_day"], sort=False)
        .size()
        .groupby(level=0)
        .max()
        .rename("max_answers_store_day")
    )
    feat = feat.join(store_day_cnt, on=ENTITY_COL)

    store_day_n = (
        work.groupby([ENTITY_COL, store_col, "answer_day"], sort=False)
        .size()
        .reset_index(name="_")
        .groupby(ENTITY_COL, sort=False)
        .size()
        .rename("n_store_days")
    )
    feat = feat.join(store_day_n, on=ENTITY_COL)

    feat["score_variance"] = feat["score_variance"].fillna(0.0)
    feat["latency_std_min"] = feat["latency_std_min"].fillna(0.0)

    return feat[feat["n_answers"] >= min_entity_n].copy()


def _prepare_model_matrix(feat: pd.DataFrame) -> pd.DataFrame:
    x = feat[list(FEATURE_COLS)].copy()
    x["n_answers"] = np.log1p(x["n_answers"])
    x["n_store_days"] = np.log1p(x["n_store_days"])
    x["n_stores"] = np.log1p(x["n_stores"])
    return x.fillna(x.median(numeric_only=True))


def anomaly_entities(
    feat: pd.DataFrame,
    config: Tier3Config | None = None,
) -> set[str]:
    """Entity keys flagged as IsolationForest anomalies (-1)."""
    config = config or Tier3Config()
    if feat.empty:
        return set()

    x_scaled = StandardScaler().fit_transform(_prepare_model_matrix(feat))
    iso = IsolationForest(
        n_estimators=config.n_estimators,
        contamination=config.contamination,
        random_state=config.random_state,
        n_jobs=-1,
    )
    pred = iso.fit_predict(x_scaled)
    return set(feat.loc[pred == -1, ENTITY_COL])


def apply_tier3(
    df: pd.DataFrame,
    mapping: ColumnMapping | None = None,
    config: Tier3Config | None = None,
) -> pd.DataFrame:
    """Flag rows belonging to IF-anomaly entities (does not drop rows)."""
    mapping = mapping or RATE_GET_ANSWERS_MAPPING
    config = config or Tier3Config()
    out = df.copy()
    out[FLAG_COL] = False
    out[REASON_COL] = ""

    if ENTITY_COL not in out.columns:
        out[ENTITY_COL] = build_entity_key(out, mapping)

    feat = build_entity_feature_table(
        out,
        mapping,
        min_entity_n=config.min_entity_n,
    )
    bad = anomaly_entities(feat, config)
    if not bad:
        return out

    bad_mask = out[ENTITY_COL].isin(bad)
    out.loc[bad_mask, FLAG_COL] = True
    out.loc[bad_mask, REASON_COL] = REASON_IF_ANOMALY
    return out


def keep_clean_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Rows not flagged by Tier 3."""
    if FLAG_COL not in df.columns:
        return df.copy()
    return df.loc[~df[FLAG_COL].astype(bool)].copy()
