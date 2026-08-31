"""Tier 3 IsolationForest entity rules — fixtures only, no live DB."""

from __future__ import annotations

import pandas as pd

from fraud_guard.tier1 import ENTITY_COL, build_entity_key
from fraud_guard.tier3 import (
    FLAG_COL,
    REASON_IF_ANOMALY,
    Tier3Config,
    apply_tier3,
    build_entity_feature_table,
    keep_clean_rows,
)


def _sample_with_mega_entity() -> pd.DataFrame:
    """Several normal entities plus one high-volume always-5 anomaly."""
    rows: list[dict[str, object]] = []
    for contact_idx in range(4):
        for i in range(5):
            rows.append(
                {
                    "UserContact": f"normal-{contact_idx}",
                    "PhoneFromLog": None,
                    "ext_user_id": 0,
                    "PrintStore": float(1 + contact_idx),
                    "AnswerTime": f"2025-01-{1 + i:02d} 12:00:00",
                    "PrintDateTime": f"2025-01-{1 + i:02d} 11:50:00",
                    "Answer_Value": 4 if i % 2 == 0 else 5,
                }
            )
    for i in range(50):
        rows.append(
            {
                "UserContact": "mega-farmer",
                "PhoneFromLog": None,
                "ext_user_id": 0,
                "PrintStore": float(1 + (i % 5)),
                "AnswerTime": f"2025-02-{1 + i % 10:02d} 12:00:00",
                "PrintDateTime": f"2025-02-{1 + i % 10:02d} 11:50:00",
                "Answer_Value": 5,
            }
        )
    df = pd.DataFrame(rows)
    df[ENTITY_COL] = build_entity_key(df)
    return df


def test_build_entity_feature_table_min_n() -> None:
    df = _sample_with_mega_entity()
    feat = build_entity_feature_table(df, min_entity_n=3)
    assert len(feat) == 5
    mega = feat[feat[ENTITY_COL].str.contains("mega-farmer", na=False)].iloc[0]
    assert mega["n_answers"] == 50
    assert mega["topbox_rate"] == 1.0


def test_apply_tier3_flags_high_volume_entity() -> None:
    df = _sample_with_mega_entity()
    flagged = apply_tier3(
        df,
        config=Tier3Config(contamination=0.2, min_entity_n=3, random_state=42),
    )
    mega = flagged[flagged[ENTITY_COL].str.contains("mega-farmer", na=False)]
    assert not mega.empty
    assert mega[FLAG_COL].all()
    assert mega["fraud_tier3_reasons"].iloc[0] == REASON_IF_ANOMALY

    clean = keep_clean_rows(flagged)
    assert "mega-farmer" not in clean[ENTITY_COL].astype(str).values
    assert len(clean) == 20
