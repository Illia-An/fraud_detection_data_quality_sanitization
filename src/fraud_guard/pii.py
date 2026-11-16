"""PII hashing for sanitization pipelines (SPEC Invariant 1 / Wave 6 S-04/S-05)."""

from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any

import pandas as pd

from fraud_guard.features import ColumnMapping

# Hex digest truncated length required by SPEC Invariant 1.
PII_HASH_LEN = 32


def pii_hmac_key() -> bytes | None:
    """Optional keyed pepper from ``PII_HMAC_KEY`` (Wave 6)."""
    raw = os.environ.get("PII_HMAC_KEY", "").strip()
    if not raw:
        return None
    return raw.encode("utf-8")


def hash_pii_value(value: Any) -> str | None:
    """Hash entity key; empty / null → None (no fake entity key).

    Uses HMAC-SHA256 when ``PII_HMAC_KEY`` is set; otherwise plain SHA-256
    (legacy / local). Digest truncated to ``PII_HASH_LEN`` hex chars.
    """
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text_value = str(value).strip()
    if not text_value or text_value in {"None", "nan", "NaT"}:
        return None
    key = pii_hmac_key()
    if key is not None:
        digest = hmac.new(key, text_value.encode("utf-8"), hashlib.sha256).hexdigest()
    else:
        digest = hashlib.sha256(text_value.encode("utf-8")).hexdigest()
    return digest[:PII_HASH_LEN]


def ensure_pii_hashed(
    df: pd.DataFrame,
    mapping: ColumnMapping,
) -> pd.DataFrame:
    """Return a copy with UserContact / PhoneFromLog hashed before grouping.

    Call once at pipeline / tier-chain entry (Wave 8 / M-10). Subsequent tier
    steps must not call this again on already-hashed columns — ``tier1``
    ``_prepare_tier_frame`` skips re-hash when ``ENTITY_COL`` is present.
    Idempotent for nulls only; hashing an already-hashed digest yields a new
    digest and must be avoided mid-run.
    """
    out = df.copy()
    for col in (mapping.entity_key, mapping.phone_from_log):
        if col and col in out.columns:
            out[col] = out[col].map(hash_pii_value)
    return out
