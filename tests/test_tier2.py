"""Tier 2 store-month rules — fixtures only, no live DB."""

from __future__ import annotations

import pandas as pd

from fraud_guard.tier2 import (
    FLAG_COL,
    REASON_HIGH_STORE_MONTH,
    Tier2Config,
    apply_tier2,
    build_store_month_panel,
    high_store_months,
    keep_clean_rows,
)


def _sample_clean() -> pd.DataFrame:
    """Two stores: one normal months, one inflated month."""
    rows = []
    # store 1: ~60% top-box over many answers
    for i in range(40):
        rows.append(
            {
                "PrintStore": 1.0,
                "Year": 2025,
                "Month": 1,
                "Answer_Value": 5 if i < 24 else 4,
            }
        )
    # store 2: 95%+ top-box (should flag)
    for i in range(40):
        rows.append(
            {
                "PrintStore": 2.0,
                "Year": 2025,
                "Month": 1,
                "Answer_Value": 5 if i < 38 else 4,
            }
        )
    # store 3: low volume — ignored by min_volume
    for i in range(5):
        rows.append(
            {
                "PrintStore": 3.0,
                "Year": 2025,
                "Month": 1,
                "Answer_Value": 5,
            }
        )
    return pd.DataFrame(rows)


def test_panel_and_high_months() -> None:
    df = _sample_clean()
    panel = build_store_month_panel(df, min_volume=30)
    assert len(panel) == 2
    high = high_store_months(panel, Tier2Config(z_high=0.5, five_pct_min=90.0))
    assert (high["PrintStore"] == 2.0).any()


def test_apply_tier2_flags_high_store_month_rows() -> None:
    df = _sample_clean()
    flagged = apply_tier2(df, config=Tier2Config(z_high=2.0, five_pct_min=90.0))
    assert FLAG_COL in flagged.columns
    # store 2 rows flagged
    assert flagged.loc[flagged["PrintStore"] == 2.0, FLAG_COL].all()
    assert (
        flagged.loc[flagged["PrintStore"] == 2.0, "fraud_tier2_reasons"].iloc[0]
        == REASON_HIGH_STORE_MONTH
    )
    # store 1 not flagged (normal rate)
    assert not flagged.loc[flagged["PrintStore"] == 1.0, FLAG_COL].any()

    clean = keep_clean_rows(flagged)
    assert (clean["PrintStore"] != 2.0).all()
