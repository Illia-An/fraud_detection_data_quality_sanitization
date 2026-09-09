"""Tier 1 rules — fixture-based, no live DB."""

from __future__ import annotations

import pandas as pd

from fraud_guard.pii import ensure_pii_hashed, hash_pii_value
from fraud_guard.stats import filter_stats, network_delta_pp, tier1_drop_reason_counts
from fraud_guard.tier1 import (
    CUSTOMER_BLACKLIST_VALUE,
    ENTITY_COL,
    FLAG_COL,
    RATE_GET_ANSWERS_MAPPING,
    REASON_ALWAYS_TOPBOX,
    REASON_BLACKLIST,
    REASON_COL,
    REASON_FREQ_STORE_DAY,
    SATISFACTION_QUESTION_ID,
    TOP_BOX_VALUE,
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
    assert (work["Question_ID"] == SATISFACTION_QUESTION_ID).all()


def test_build_entity_key_prefers_contact_over_zero_ext() -> None:
    raw = pd.DataFrame(
        {
            "UserContact": [" 999 ", None, None],
            "PhoneFromLog": [None, "888", None],
            "ext_user_id": [0, 0, 42],
        }
    )
    hashed = ensure_pii_hashed(raw, RATE_GET_ANSWERS_MAPPING)
    keys = build_entity_key(hashed)
    assert list(keys) == [
        f"c:{hash_pii_value('999')}",
        f"p:{hash_pii_value('888')}",
        "u:42",
    ]


def test_apply_tier1_hashes_pii_before_grouping() -> None:
    work = filter_answered_metric_rows(_sample_answered())
    flagged = apply_tier1(work, config=Tier1Config(enable_always_topbox=False))
    assert flagged["UserContact"].iloc[0] == hash_pii_value("111")
    assert flagged["PhoneFromLog"].isna().all()
    assert ENTITY_COL in flagged.columns
    assert flagged.loc[flagged["ParticipateNumber"] == "p1", ENTITY_COL].iloc[0] == (
        f"c:{hash_pii_value('111')}"
    )


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
    # 111 answered 3 times same store same day (matched via hashed contact)
    contact_111 = hash_pii_value("111")
    assert flagged.loc[flagged["UserContact"] == contact_111, FLAG_COL].all()
    assert REASON_FREQ_STORE_DAY in flagged.loc[
        flagged["UserContact"] == contact_111, REASON_COL
    ].iloc[0]

    clean = keep_clean_rows(flagged)
    stats = filter_stats(flagged, clean)
    assert stats.rows_dropped >= 4
    reasons = tier1_drop_reason_counts(flagged)
    assert reasons.get(REASON_BLACKLIST, 0) >= 1
    assert reasons.get(REASON_FREQ_STORE_DAY, 0) >= 3


def test_always_topbox_optional() -> None:
    work = filter_answered_metric_rows(_sample_answered())
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
    contact_444 = hash_pii_value("444")
    assert flagged.loc[flagged["UserContact"] == contact_444, FLAG_COL].all()
    assert REASON_ALWAYS_TOPBOX in flagged.loc[
        flagged["UserContact"] == contact_444, REASON_COL
    ].iloc[0]


def test_top_box_rate() -> None:
    df = pd.DataFrame({"Answer_Value": [5, 5, 4, 5]})
    assert top_box_rate(df) == 0.75
    assert TOP_BOX_VALUE == 5


def test_network_delta_pp_invariant_5() -> None:
    assert network_delta_pp(65.0, 70.0) == -5.0
    assert network_delta_pp(70.0, 70.0) == 0.0
