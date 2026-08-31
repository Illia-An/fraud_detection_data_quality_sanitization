"""Before/after filter accounting helpers."""

from __future__ import annotations

import pandas as pd

from fraud_guard.contracts import FilterStats
from fraud_guard.tier1 import FLAG_COL


def filter_stats(before: pd.DataFrame, after: pd.DataFrame) -> FilterStats:
    """Compare row counts before vs after filtering."""
    rows_read = len(before)
    rows_kept = len(after)
    return FilterStats(
        rows_read=rows_read,
        rows_kept=rows_kept,
        rows_dropped=max(rows_read - rows_kept, 0),
    )


def tier1_drop_reason_counts(flagged: pd.DataFrame, reason_col: str = "fraud_tier1_reasons") -> dict[str, int]:
    """Count drop reasons from a Tier-1 flagged frame (comma-separated reasons)."""
    if reason_col not in flagged.columns or FLAG_COL not in flagged.columns:
        return {}
    dropped = flagged.loc[flagged[FLAG_COL].astype(bool), reason_col].fillna("")
    counts: dict[str, int] = {}
    for cell in dropped:
        for reason in str(cell).split(","):
            key = reason.strip()
            if not key:
                continue
            counts[key] = counts.get(key, 0) + 1
    return counts
