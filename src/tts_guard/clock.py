"""TTS clock: UpDatetime → BumpDateTime in seconds (SPEC-tts Invariant T1)."""

from __future__ import annotations

import pandas as pd

TTS_SEC_COL = "tts_sec"

# McKitiBump column names
COL_STORE = "StoreIndex"
COL_SALE_DATE = "SaleDate"
COL_WEBORDER = "WeborderID"
COL_UP = "UpDatetime"
COL_BUMP = "BumpDateTime"


def tts_seconds_series(up: pd.Series, bump: pd.Series) -> pd.Series:
    """Vectorized dwell seconds; NaT/null bump → NaN."""
    up_ts = pd.to_datetime(up, errors="coerce")
    bump_ts = pd.to_datetime(bump, errors="coerce")
    delta = (bump_ts - up_ts).dt.total_seconds()
    return delta


def attach_tts_sec(df: pd.DataFrame) -> pd.DataFrame:
    """Return copy with ``tts_sec``; rows without bump stay NaN."""
    if COL_UP not in df.columns or COL_BUMP not in df.columns:
        raise ValueError(f"DataFrame must include {COL_UP} and {COL_BUMP}")
    out = df.copy()
    out[TTS_SEC_COL] = tts_seconds_series(out[COL_UP], out[COL_BUMP])
    return out


def valid_tts_mask(df: pd.DataFrame) -> pd.Series:
    """Rows with a finite ``tts_sec`` (bump present and clocks parseable)."""
    if TTS_SEC_COL not in df.columns:
        raise ValueError(f"missing {TTS_SEC_COL}; call attach_tts_sec first")
    return df[TTS_SEC_COL].notna()


def order_key_frame(df: pd.DataFrame) -> pd.Series:
    """Order grain: StoreIndex + calendar SaleDate + WeborderID."""
    for col in (COL_STORE, COL_SALE_DATE, COL_WEBORDER):
        if col not in df.columns:
            raise ValueError(f"order_agg requires column {col}")
    sale_day = pd.to_datetime(df[COL_SALE_DATE], errors="coerce").dt.normalize()
    return (
        df[COL_STORE].astype(str)
        + "|"
        + sale_day.dt.strftime("%Y-%m-%d")
        + "|"
        + df[COL_WEBORDER].astype(str)
    )
