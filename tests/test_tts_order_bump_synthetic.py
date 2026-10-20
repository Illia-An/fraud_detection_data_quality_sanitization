"""Synthetic V_TTS_OrderBump — shape and ТЗ invariants."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from tts_order_bump.columns import ORDER_BUMP_COLUMNS
from tts_order_bump.synthetic import (
    generate_order_bump_preset,
    order_bump_preset_meta,
)


def test_small_has_required_columns_and_volume() -> None:
    rows = generate_order_bump_preset("small")
    assert len(rows) > 40
    assert set(rows[0].keys()) == set(ORDER_BUMP_COLUMNS)
    assert list(rows[0].keys()) == list(ORDER_BUMP_COLUMNS)


def test_order_tts_stable_per_order_key() -> None:
    rows = generate_order_bump_preset("small")
    by_key: dict[str, set[float]] = defaultdict(set)
    for row in rows:
        by_key[row["order_key"]].add(row["order_tts_sec"])
    assert by_key
    for key, values in by_key.items():
        assert len(values) == 1, f"order_tts_sec drift on {key}: {values}"


def test_order_tts_in_seconds_not_minutes() -> None:
    rows = generate_order_bump_preset("small")
    tts_values = [r["order_tts_sec"] for r in rows]
    mean = sum(tts_values) / len(tts_values)
    # ~4 min → hundreds of seconds, not ~4.
    assert 150 <= mean <= 400
    assert all(r["order_tts_unit_raw"] == "sec" for r in rows)


def test_ge30_flags_and_short_share() -> None:
    rows = generate_order_bump_preset("small")
    valid = [r for r in rows if r["bump_valid"]]
    assert valid
    for row in valid:
        assert row["bump_tts_sec"] is not None
        assert row["bump_ge30"] == (row["bump_tts_sec"] >= 30)
        up = datetime.fromisoformat(row["up_datetime"])
        bump = datetime.fromisoformat(row["bump_datetime"])
        assert abs((bump - up).total_seconds() - row["bump_tts_sec"]) < 1.01

    shorts = [r for r in valid if not r["bump_ge30"]]
    share = len(shorts) / len(valid)
    assert 0.03 <= share <= 0.25


def test_join_match_and_sources() -> None:
    rows = generate_order_bump_preset("small")
    assert all(r["join_match"] is True for r in rows)
    assert all(r["transh_row_present"] is True for r in rows)
    assert all(r["mckiti_row_present"] is True for r in rows)
    assert all(r["source_view_transh"].startswith("dbo.") for r in rows)


def test_at_least_two_months() -> None:
    for preset in ("small", "medium"):
        rows = generate_order_bump_preset(preset)  # type: ignore[arg-type]
        months = {(r["year"], r["month"]) for r in rows}
        assert len(months) >= 2


def test_bump_uid_unique_and_seq_positive() -> None:
    rows = generate_order_bump_preset("small")
    uids = [r["bump_uid"] for r in rows]
    assert len(uids) == len(set(uids))
    assert all(r["bump_seq"] >= 1 for r in rows)


def test_meta_counts() -> None:
    rows = generate_order_bump_preset("small")
    meta = order_bump_preset_meta("small", rows)
    assert meta["row_count"] == len(rows)
    assert meta["store_count"] == 2
    assert meta["month_count"] == 2
    assert meta["order_count"] > 0
    assert meta["short_bump_count"] > 0


def test_deterministic_seed() -> None:
    a = generate_order_bump_preset("small")
    b = generate_order_bump_preset("small")
    assert a == b
