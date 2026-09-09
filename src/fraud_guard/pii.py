"""PII hashing for sanitization pipelines (SPEC Invariant 1)."""

from __future__ import annotations

import hashlib
from typing import Any

import pandas as pd

from fraud_guard.features import ColumnMapping

# SHA-256 hex digest truncated length required by SPEC Invariant 1.
PII_HASH_LEN = 32


def hash_pii_value(value: Any) -> str | None:
    """SHA-256 truncated to 32 chars; empty / null → None (no fake entity key)."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text_value = str(value).strip()
    if not text_value or text_value in {"None", "nan", "NaT"}:
        return None
    return hashlib.sha256(text_value.encode("utf-8")).hexdigest()[:PII_HASH_LEN]


def ensure_pii_hashed(
    df: pd.DataFrame,
    mapping: ColumnMapping,
) -> pd.DataFrame:
    """Return a copy with UserContact / PhoneFromLog hashed before grouping.

    Idempotent for nulls; non-null values are always re-hashed (call once at
    pipeline entry so entity keys stay stable within a run).
    """
    out = df.copy()
    for col in (mapping.entity_key, mapping.phone_from_log):
        if col and col in out.columns:
            out[col] = out[col].map(hash_pii_value)
    return out
