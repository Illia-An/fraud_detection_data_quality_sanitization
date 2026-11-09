"""Historical realistic monthly improve caps (SPEC-P001 O-01 default: max_mom)."""

from __future__ import annotations

from planner.cumulative_slope.types import HistoryCapMode


def month_over_month_deltas(scores: list[float]) -> list[float]:
    if len(scores) < 2:
        return []
    return [scores[i] - scores[i - 1] for i in range(1, len(scores))]


def history_cap(
    scores: list[float],
    *,
    mode: HistoryCapMode = "max_mom",
    min_cap: float = 0.25,
) -> float:
    """Max realistic positive monthly step from store history.

    - max_mom: max positive MoM delta (O-01 default)
    - p95_mom: 95th percentile of positive MoM (fallback to max if few samples)
    - best_window: max average positive rate over any 3-month window
    """
    if min_cap < 0:
        raise ValueError("min_cap must be >= 0")
    deltas = month_over_month_deltas(scores)
    positives = [d for d in deltas if d > 0]

    if mode == "max_mom":
        raw = max(positives) if positives else 0.0
    elif mode == "p95_mom":
        if not positives:
            raw = 0.0
        else:
            ordered = sorted(positives)
            idx = min(len(ordered) - 1, max(0, int(round(0.95 * (len(ordered) - 1)))))
            raw = ordered[idx]
    elif mode == "best_window":
        raw = _best_window_rate(scores)
    else:
        raise ValueError(f"unknown history_cap_mode: {mode}")

    return max(min_cap, raw)


def _best_window_rate(scores: list[float], window: int = 3) -> float:
    if len(scores) < 2:
        return 0.0
    best = 0.0
    w = min(window, len(scores) - 1)
    for start in range(0, len(scores) - w):
        gain = scores[start + w] - scores[start]
        rate = gain / w
        if rate > best:
            best = rate
    return max(0.0, best)
