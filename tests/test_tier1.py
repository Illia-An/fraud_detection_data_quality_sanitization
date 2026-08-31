"""Tier 1 rules — fixture-based, no live DB."""

from __future__ import annotations

import pandas as pd

from fraud_guard.stats import filter_stats, tier1_drop_reason_counts
from fraud_guard.tier1 import (
    CUSTOMER_BLACKLIST_VALUE,
    FLAG_COL,
    REASON_ALWAYS_TOPBOX,
    REASON_BLACKLIST,
    REASON_COL,
    REASON_FREQ_STORE_DAY,
    Tier1Config,
    apply_tier1,
    build_entity_key,
    filter_answered_metric_rows,
    keep_clean_rows,
    top_box_rate,
)


def _sample_answered() -> pd.DataFrame:
    """Small synthetic frame shaped like RateGetAnswers answered rows."""
    return pd.DataFrame(
        {
            "ParticipateNumber": [f"p{i}" for i in range(1, 12)],
            "Question_ID": [10012] * 10 + [999],
            "Answer_Value": [5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5],
            "BlackList": [
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                "עובד",
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
                CUSTOMER_BLACKLIST_VALUE,
            ],
            "UserContact": [
                "111",
                "111",
                "111",
                "222",
                "333",
                "444",
                "444",
                "444",
                "444",
                "444",
                "555",
            ],
            "PhoneFromLog": [None] * 11,
            "ext_user_id": [0] * 11,
            "PrintStore": [1, 1, 1, 1, 2, 3, 3, 3, 3, 3, 2],
            "AnswerTime": pd.to_datetime(
                [
                    "2025-01-01 10:00",
                    "2025-01-01 11:00",
                    "2025-01-01 12:00",
                    "2025-01-01 13:00",
                    "2025-01-02 10:00",
                    "2025-02-01 10:00",
                    "2025-02-02 10:00",
                    "2025-02-03 10:00",
                    "2025-02-04 10:00",
                    "2025-02-05 10:00",
                    "2025-01-03 10:00",
                ]
            ),
        }
    )


def test_filter_answered_metric_rows() -> None:
    df = _sample_answered()
    work = filter_answered_metric_rows(df)
    assert len(work) == 10
    assert (work["Question_ID"] == 10012).all()


def test_build_entity_key_prefers_contact_over_zero_ext() -> None:
    df = pd.DataFrame(
        {
            "UserContact": [" 999 ", None, None],
            "PhoneFromLog": [None, "888", None],
            "ext_user_id": [0, 0, 42],
        }
    )
    keys = build_entity_key(df)
    assert list(keys) == ["c:999", "p:888", "u:42"]


def test_blacklist_and_freq_rules_mvp() -> None:
    work = filter_answered_metric_rows(_sample_answered())
    flagged = apply_tier1(
        work,
        config=Tier1Config(enable_always_topbox=False),
    )
    # employee row
    assert flagged.loc[flagged["ParticipateNumber"] == "p4", FLAG_COL].iloc[0]
    assert REASON_BLACKLIST in flagged.loc[
        flagged["ParticipateNumber"] == "p4", REASON_COL
    ].iloc[0]
    # 111 answered 3 times same store same day
    assert flagged.loc[flagged["UserContact"] == "111", FLAG_COL].all()
    assert REASON_FREQ_STORE_DAY in flagged.loc[
        flagged["UserContact"] == "111", REASON_COL
    ].iloc[0]

    clean = keep_clean_rows(flagged)
    stats = filter_stats(flagged, clean)
    assert stats.rows_dropped >= 4
    reasons = tier1_drop_reason_counts(flagged)
    assert reasons.get(REASON_BLACKLIST, 0) >= 1
    assert reasons.get(REASON_FREQ_STORE_DAY, 0) >= 3


def test_always_topbox_optional() -> None:
    work = filter_answered_metric_rows(_sample_answered())
    # first apply MVP so always5 sees remaining; use always5 alone on customers
    customers = work[work["BlackList"] == CUSTOMER_BLACKLIST_VALUE]
    flagged = apply_tier1(
        customers,
        config=Tier1Config(
            enable_blacklist=False,
            enable_freq_store_day=False,
            enable_always_topbox=True,
            always_topbox_min_n=5,
        ),
    )
    # contact 444 has 5 answers all 5s
    assert flagged.loc[flagged["UserContact"] == "444", FLAG_COL].all()
    assert REASON_ALWAYS_TOPBOX in flagged.loc[
        flagged["UserContact"] == "444", REASON_COL
    ].iloc[0]


def test_top_box_rate() -> None:
    df = pd.DataFrame({"Answer_Value": [5, 5, 4, 5]})
    assert top_box_rate(df) == 0.75
