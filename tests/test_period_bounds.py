"""Wave 1 mid-month normalization helpers."""

from __future__ import annotations

from datetime import date

from backend.period_bounds import normalize_snapshot_period


def test_normalize_snapshot_period_mid_month() -> None:
    start, end, changed = normalize_snapshot_period(
        date(2026, 2, 15), date(2026, 2, 20)
    )
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)
    assert changed is True


def test_normalize_snapshot_period_already_aligned() -> None:
    start, end, changed = normalize_snapshot_period(
        date(2026, 2, 1), date(2026, 2, 28)
    )
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)
    assert changed is False


def test_normalize_snapshot_period_open_end() -> None:
    start, end, changed = normalize_snapshot_period(date(2026, 3, 10), None)
    assert start == date(2026, 3, 1)
    assert end is None
    assert changed is True
