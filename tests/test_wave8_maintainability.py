"""Wave 8 maintainability / product twins."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from fraud_guard.pipeline_row_rules import (
    ENTITY_COL,
    FLAG_COL,
    RATE_GET_ANSWERS_MAPPING,
    apply_blacklist_tier,
    apply_freq_tier,
)
from planner.five_percent import plan_five_percent
from planner.tts import plan_tts
from planner.tts_bounds import TTS_CEILING_MIN, TTS_FLOOR_MIN, tts_bounds_payload


def test_allocate_aligns_floor_ceiling_validation() -> None:
    with pytest.raises(ValueError, match="floor must be below ceiling"):
        plan_five_percent(
            baseline={1: 50.0},
            target=60.0,
            n_months=3,
            reference_year=2026,
            reference_month=1,
            floor=10.0,
            ceiling=10.0,
        )


def test_tts_and_five_percent_share_allocator_direction() -> None:
    fp = plan_five_percent(
        baseline={1: 40.0, 2: 50.0},
        target=55.0,
        n_months=2,
        reference_year=2026,
        reference_month=1,
        max_monthly_improve=4.0,
    )
    assert fp.direction == "higher_is_better"
    assert fp.final_chain >= fp.current_chain - 1e-8

    tts = plan_tts(
        baseline={1: 5.0, 2: 4.0},
        target=3.5,
        n_months=2,
        reference_year=2026,
        reference_month=1,
    )
    assert tts.direction == "lower_is_better"
    assert tts.final_chain <= tts.current_chain + 1e-8


def test_tts_bounds_endpoint_matches_module() -> None:
    client = TestClient(create_app())
    res = client.get("/api/v1/plans-tts/bounds")
    assert res.status_code == 200
    body = res.json()
    assert body == tts_bounds_payload()
    assert body["floor"] == TTS_FLOOR_MIN
    assert body["ceiling"] == TTS_CEILING_MIN


def test_pii_hashed_once_across_tier_chain() -> None:
    from fraud_guard.pii import hash_pii_value

    contact = "050-1111111"
    once = hash_pii_value(contact)
    df = pd.DataFrame(
        [
            {
                "ParticipateNumber": "p1",
                "Question_ID": 10012,
                "Answer_Value": 5,
                "BlackList": "לא",
                "UserContact": contact,
                "PhoneFromLog": None,
                "ext_user_id": None,
                "PrintStore": 1.0,
                "AnswerTime": "2026-02-01T10:00:00",
                "Year": 2026,
                "Month": 2,
            }
        ]
    )
    t1 = apply_blacklist_tier(df)
    assert t1.iloc[0]["UserContact"] == once
    assert ENTITY_COL in t1.columns
    t2 = apply_freq_tier(t1)
    # Second step must not re-hash (would rotate the digest).
    assert t2.iloc[0]["UserContact"] == once
    assert FLAG_COL in t2.columns


def test_pipeline_step_aliases_importable() -> None:
    from fraud_guard.pipeline_steps import (
        apply_pipeline_tier1,
        apply_pipeline_tier4,
    )

    assert callable(apply_pipeline_tier1)
    assert callable(apply_pipeline_tier4)


def test_legacy_api_package_removed() -> None:
    assert not (Path("api") / "main.py").is_file()


def test_snapshot_base_helpers() -> None:
    from backend.snapshot_base import resolve_sqlite_file_url, resolve_sqlite_path_from_url
    from pathlib import Path

    default = Path("data/x.sqlite")
    url = resolve_sqlite_file_url("", default_path=default)
    assert url.startswith("sqlite:///")
    path = resolve_sqlite_path_from_url(url, default_path=default)
    assert path.name == "x.sqlite"
