"""Calendar month helpers for cumulative-slope planner."""

from __future__ import annotations

from planner.cumulative_slope.types import YearMonth


def ym_index(ym: YearMonth) -> int:
    return ym.year * 12 + (ym.month - 1)


def index_to_ym(idx: int) -> YearMonth:
    return YearMonth(year=idx // 12, month=idx % 12 + 1)


def add_months(ym: YearMonth, offset: int) -> YearMonth:
    return index_to_ym(ym_index(ym) + offset)


def month_span(start: YearMonth, end: YearMonth) -> list[YearMonth]:
    """Inclusive list of months from start through end."""
    a, b = ym_index(start), ym_index(end)
    if b < a:
        raise ValueError("end must be on or after start")
    return [index_to_ym(i) for i in range(a, b + 1)]


def compare_ym(a: YearMonth, b: YearMonth) -> int:
    return ym_index(a) - ym_index(b)
