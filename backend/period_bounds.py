"""Calendar period helpers for snapshot Query A/B parity (Wave 1 / A-02)."""

from __future__ import annotations

import calendar
from datetime import date


def normalize_snapshot_period(
    period_start: date,
    period_end: date | None,
) -> tuple[date, date | None, bool]:
    """Snap inclusive bounds to calendar months (W1-MID A).

    ``from`` → first day of its month; ``to`` → last day of its month.
    Open-ended ``to`` (``None``) stays open. Returns ``(start, end, changed)``.
    """
    new_start = period_start.replace(day=1)
    if period_end is None:
        new_end: date | None = None
    else:
        last_day = calendar.monthrange(period_end.year, period_end.month)[1]
        new_end = period_end.replace(day=last_day)
    changed = new_start != period_start or new_end != period_end
    return new_start, new_end, changed
