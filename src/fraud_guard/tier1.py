"""Tier 1: deterministic Pandas rules for survey sanitization.

Experiment-backed rules (SummerCampain.dbo.TargetsByMetrics_RateGetAnswers):
1. Non-customer BlackList segments (keep only לא)
2. High frequency: same entity × store × day >= threshold
3. Optional: always top-box (5) with enough history

SPEC invariants enforced here:
- Invariant 1: hash UserContact / PhoneFromLog before any entity grouping
- Invariant 2: entity key = contact → phone → ext_user_id (!= 0) → None
- Invariant 3: Question_ID = 10012; top-box Answer_Value = 5
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from fraud_guard.features import ColumnMapping
from fraud_guard.pii import ensure_pii_hashed

FLAG_COL = "fraud_tier1_flag"
REASON_COL = "fraud_tier1_reasons"
ENTITY_COL = "entity_key"

REASON_BLACKLIST = "blacklist_non_customer"
REASON_FREQ_STORE_DAY = "high_freq_store_day"
REASON_ALWAYS_TOPBOX = "always_topbox"

# Hebrew: "no" / regular customer segment in BlackList
CUSTOMER_BLACKLIST_VALUE = "לא"

SATISFACTION_QUESTION_ID = 10012
TOP_BOX_VALUE = 5

RATE_GET_ANSWERS_MAPPING = ColumnMapping(
    entity_key="UserContact",
    store_id="PrintStore",
    event_ts="AnswerTime",
    survey_id="ParticipateNumber",
    question_id="Question_ID",
    answer_value="Answer_Value",
    channel="ContactType",
    checkout_ts="PrintDateTime",
    blacklist="BlackList",
    phone_from_log="PhoneFromLog",
    ext_user_id="ext_user_id",
)


@dataclass(frozen=True)
class Tier1Config:
    """Thresholds and rule toggles for Tier 1."""

    customer_blacklist_value: str = CUSTOMER_BLACKLIST_VALUE
    enable_blacklist: bool = True
    enable_freq_store_day: bool = True
    enable_always_topbox: bool = False  # optional / stakeholder-gated
    freq_store_day_min: int = 3
    always_topbox_min_n: int = 10


def filter_answered_metric_rows(
    df: pd.DataFrame,
    mapping: ColumnMapping = RATE_GET_ANSWERS_MAPPING,
) -> pd.DataFrame:
    """Keep Q10012 rows with a non-null answer (SPEC Invariant 3)."""
    q_col = mapping.question_id
    a_col = mapping.answer_value
    if q_col is None or a_col is None:
        raise ValueError("mapping.question_id and mapping.answer_value are required")
    mask = df[q_col].eq(SATISFACTION_QUESTION_ID) & df[a_col].notna()
    return df.loc[mask].copy()


def build_entity_key(
    df: pd.DataFrame,
    mapping: ColumnMapping = RATE_GET_ANSWERS_MAPPING,
) -> pd.Series:
    """Resolve identity key (SPEC Invariant 2): contact → phone → ext_user_id → None.

    Expects UserContact / PhoneFromLog to already be hashed (Invariant 1).
    Call ``ensure_pii_hashed`` first when feeding raw PII.
    """
    n = len(df)
    keys = pd.Series([None] * n, index=df.index, dtype=object)

    def _usable_text(series: pd.Series) -> pd.Series:
        as_str = series.astype(str).str.strip()
        return series.notna() & ~as_str.isin(["", "None", "nan", "NaT"])

    if mapping.entity_key and mapping.entity_key in df.columns:
        contact_ok = _usable_text(df[mapping.entity_key])
        keys = keys.where(~contact_ok, "c:" + df[mapping.entity_key].astype(str).str.strip())

    if mapping.phone_from_log and mapping.phone_from_log in df.columns:
        need = keys.isna()
        phone_ok = need & _usable_text(df[mapping.phone_from_log])
        keys = keys.where(~phone_ok, "p:" + df[mapping.phone_from_log].astype(str).str.strip())

    if mapping.ext_user_id and mapping.ext_user_id in df.columns:
        need = keys.isna()
        uid = pd.to_numeric(df[mapping.ext_user_id], errors="coerce")
        uid_ok = need & uid.notna() & (uid != 0)
        keys = keys.where(~uid_ok, "u:" + uid.fillna(0).astype(int).astype(str))

    return keys


def _append_reason(reasons: pd.Series, mask: pd.Series, reason: str) -> pd.Series:
    out = reasons.copy()
    has = mask.fillna(False).astype(bool)
    empty = out.eq("")
    out.loc[has & empty] = reason
    out.loc[has & ~empty] = out.loc[has & ~empty] + "," + reason
    return out


def _flag_blacklist(
    out: pd.DataFrame,
    mapping: ColumnMapping,
    config: Tier1Config,
) -> pd.DataFrame:
    col = mapping.blacklist
    if not col or col not in out.columns:
        return out
    bad = out[col].fillna("") != config.customer_blacklist_value
    out.loc[bad, FLAG_COL] = True
    out[REASON_COL] = _append_reason(out[REASON_COL], bad, REASON_BLACKLIST)
    return out


def _flag_freq_store_day(
    out: pd.DataFrame,
    mapping: ColumnMapping,
    config: Tier1Config,
) -> pd.DataFrame:
    store_col = mapping.store_id
    ts_col = mapping.event_ts
    if not store_col or not ts_col:
        return out
    if ENTITY_COL not in out.columns:
        out[ENTITY_COL] = build_entity_key(out, mapping)

    day = pd.to_datetime(out[ts_col], errors="coerce").dt.date
    eligible = (
        out[ENTITY_COL].notna()
        & out[store_col].notna()
        & pd.Series(day, index=out.index).notna()
    )
    if not eligible.any():
        return out

    gsize = (
        out.loc[eligible]
        .groupby(
            [
                out.loc[eligible, ENTITY_COL],
                out.loc[eligible, store_col],
                day.loc[eligible],
            ]
        )[ENTITY_COL]
        .transform("size")
    )
    # align back to full index (NaN from bad timestamps → 0)
    sizes = pd.Series(0, index=out.index, dtype=int)
    sizes.loc[eligible] = pd.to_numeric(gsize, errors="coerce").fillna(0).astype(int)
    bad = eligible & (sizes >= config.freq_store_day_min)
    out.loc[bad, FLAG_COL] = True
    out[REASON_COL] = _append_reason(out[REASON_COL], bad, REASON_FREQ_STORE_DAY)
    return out


def _flag_always_topbox(
    out: pd.DataFrame,
    mapping: ColumnMapping,
    config: Tier1Config,
) -> pd.DataFrame:
    a_col = mapping.answer_value
    if not a_col:
        return out
    if ENTITY_COL not in out.columns:
        out[ENTITY_COL] = build_entity_key(out, mapping)

    eligible = out[ENTITY_COL].notna()
    if not eligible.any():
        return out

    grouped = (
        out.loc[eligible]
        .groupby(ENTITY_COL)[a_col]
        .agg(n="count", top_rate=lambda s: (s == TOP_BOX_VALUE).mean())
    )
    bad_entities = grouped.index[
        (grouped["n"] >= config.always_topbox_min_n) & (grouped["top_rate"] >= 1.0)
    ]
    bad = eligible & out[ENTITY_COL].isin(set(bad_entities))
    out.loc[bad, FLAG_COL] = True
    out[REASON_COL] = _append_reason(out[REASON_COL], bad, REASON_ALWAYS_TOPBOX)
    return out


def apply_tier1(
    df: pd.DataFrame,
    mapping: ColumnMapping | None = None,
    config: Tier1Config | None = None,
) -> pd.DataFrame:
    """Return a copy with Tier-1 flags and reason codes (rows are not dropped)."""
    mapping = mapping or RATE_GET_ANSWERS_MAPPING
    config = config or Tier1Config()
    # Invariant 1: hash PII before any in-memory entity grouping.
    out = ensure_pii_hashed(df, mapping)
    out[FLAG_COL] = False
    out[REASON_COL] = ""
    out[ENTITY_COL] = build_entity_key(out, mapping)

    if config.enable_blacklist:
        out = _flag_blacklist(out, mapping, config)
    if config.enable_freq_store_day:
        out = _flag_freq_store_day(out, mapping, config)
    if config.enable_always_topbox:
        out = _flag_always_topbox(out, mapping, config)

    return out


def keep_clean_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Rows not flagged by Tier 1."""
    if FLAG_COL not in df.columns:
        return df.copy()
    return df.loc[~df[FLAG_COL].astype(bool)].copy()


def top_box_rate(
    df: pd.DataFrame,
    mapping: ColumnMapping = RATE_GET_ANSWERS_MAPPING,
) -> float:
    """Share of Answer_Value == 5 (SPEC Invariant 3)."""
    a_col = mapping.answer_value
    if not a_col or a_col not in df.columns or len(df) == 0:
        return float("nan")
    return float((df[a_col] == TOP_BOX_VALUE).mean())
