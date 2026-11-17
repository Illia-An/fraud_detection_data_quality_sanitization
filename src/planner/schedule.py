"""Month-schedule helpers shared by the allocator and its callers."""

from __future__ import annotations


def trajectory_weights(
    n_months: int,
    mode: str = "uniform",
    power: float = 2.0,
) -> list[float]:
    if n_months < 1:
        raise ValueError("n_months must be >= 1")
    months = list(range(1, n_months + 1))
    if mode == "uniform":
        raw = [1.0] * n_months
    elif mode == "front_loaded":
        raw = [float((n_months - m + 1) ** power) for m in months]
    elif mode == "accelerated":
        raw = [float(m**power) for m in months]
    else:
        raise ValueError("mode must be uniform|front_loaded|accelerated")
    total = sum(raw)
    return [w / total for w in raw]


def add_calendar_months(year: int, month: int, offset: int) -> tuple[int, int]:
    """Return (year, month) offset months after the given calendar month (1-based)."""
    idx = year * 12 + (month - 1) + offset
    return idx // 12, idx % 12 + 1
