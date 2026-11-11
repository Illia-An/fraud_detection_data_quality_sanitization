"""Running equal-mean cumulatives (same grammar as FE cumulativeMeanSeries)."""

from __future__ import annotations

from planner.cumulative_slope.types import MonthScore, YearMonth


def cumulative_mean(scores: list[float]) -> list[float]:
    """c_t = mean(m_1 … m_t) for a contiguous monthly series."""
    out: list[float] = []
    total = 0.0
    for i, score in enumerate(scores, start=1):
        total += score
        out.append(total / i)
    return out


def zip_month_scores(months: list[YearMonth], scores: list[float]) -> tuple[MonthScore, ...]:
    if len(months) != len(scores):
        raise ValueError("months and scores length mismatch")
    return tuple(
        MonthScore(year=m.year, month=m.month, score=round(s, 4))
        for m, s in zip(months, scores, strict=True)
    )


def stitch_cumulative_actual_or_sim(
    actual_months: list[YearMonth],
    actual_scores: list[float],
    sim_months: list[YearMonth],
    sim_scores: list[float],
) -> tuple[MonthScore, ...]:
    """Actual cumulatives through as-of, then continue with sim monthlies.

    Continuity: first sim cumulative step uses the same running sum/count as last actual.
    """
    if not actual_scores:
        raise ValueError("actual_scores must not be empty")
    if len(actual_months) != len(actual_scores):
        raise ValueError("actual months/scores mismatch")
    if len(sim_months) != len(sim_scores):
        raise ValueError("sim months/scores mismatch")

    actual_cum = cumulative_mean(actual_scores)
    combined_scores = list(actual_scores) + list(sim_scores)
    combined_months = list(actual_months) + list(sim_months)
    combined_cum = cumulative_mean(combined_scores)
    # Sanity: prefix matches actual cumulatives
    for i, c in enumerate(actual_cum):
        if abs(combined_cum[i] - c) > 1e-9:
            raise RuntimeError("cumulative handoff broke actual prefix")
    return zip_month_scores(combined_months, combined_cum)
