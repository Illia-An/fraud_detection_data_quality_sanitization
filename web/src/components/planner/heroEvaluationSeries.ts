/** Build Evaluation-View series for the Planner hero (fact | as-of | forecast). */

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

/** Months before as-of where the short-window cumulative may start (inclusive). */
export const CUMULATIVE_WINDOW_LAG_MONTHS = 3;

export interface HeroEvaluationSeries {
  labels: string[];
  factYs: (number | null)[];
  /** Running mean of monthly network equal-means from first fact month (product lock). */
  cumulativeYs: (number | null)[];
  /**
   * Short-window running mean from as-of − lag through as-of, then a linear cumulative
   * path that reaches {@link HeroEvaluationSeries.target} at the end of the plan horizon
   * (“if the plan hits target”).
   */
  windowCumulativeYs: (number | null)[];
  /**
   * Absolute short-window + pure-draft horizon mean from the fact handoff onward (green).
   */
  planCumulativeYs: (number | null)[];
  draftYs: (number | null)[];
  upperYs: (number | null)[];
  lowerYs: (number | null)[];
  /** Plan target level (drawn as a horizontal reference on the hero). */
  target: number;
  asOfLabel: string;
  /** Inclusive start of the short-window cumulative (as-of − lag). */
  windowStartLabel: string;
}

interface PeriodPoint {
  year: number;
  month: number;
}

function periodCmp(a: PeriodPoint, b: PeriodPoint): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function atOrBefore(a: PeriodPoint, b: PeriodPoint): boolean {
  return periodCmp(a, b) <= 0;
}

function atOrAfter(a: PeriodPoint, b: PeriodPoint): boolean {
  return periodCmp(a, b) >= 0;
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Shift calendar month by delta (negative = earlier). */
export function shiftCalendarMonths(
  year: number,
  month: number,
  delta: number,
): PeriodPoint {
  const zeroBased = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  };
}

function networkActual(
  panel: SanitizedPanel,
  year: number,
  month: number,
  storeIds: number[],
): number | null {
  const ids = storeIds.length > 0 ? storeIds : [...new Set(panel.rows.map((r) => r.store_id))];
  const scores: number[] = [];
  for (const storeId of ids) {
    const row = panel.rows.find(
      (r) => r.store_id === storeId && r.year === year && r.month === month,
    );
    if (row) {
      scores.push(row.five_percent);
    }
  }
  if (scores.length === 0) {
    return null;
  }
  return roundPct(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Running equal-mean of monthly network scores: c_t = mean(m_1 … m_t).
 * Null months (after as-of / missing) are skipped and stay null.
 */
export function cumulativeMeanSeries(monthly: (number | null)[]): (number | null)[] {
  let sum = 0;
  let count = 0;
  return monthly.map((value) => {
    if (value == null) {
      return null;
    }
    sum += value;
    count += 1;
    return roundPct(sum / count);
  });
}

/**
 * Cumulative levels after handoff that land on target at step N (1-based).
 * step k → startCum + (target − startCum) * k / N.
 */
export function linearCumulativePathToTarget(
  startCum: number,
  target: number,
  horizonSteps: number,
): number[] {
  if (horizonSteps <= 0) {
    return [];
  }
  return Array.from({ length: horizonSteps }, (_, i) =>
    roundPct(startCum + ((target - startCum) * (i + 1)) / horizonSteps),
  );
}

/**
 * Timeline = cleansed panel months ≤ as-of ∪ plan trajectory months (horizon).
 * Fact / full cumulative (purple): solid left of / on as-of.
 * Orange: short-window actual mean, then linear cumulative path that reaches target.
 * Green: short-window + pure draft cumulative (what the draft actually scores).
 * Blue / cone: monthly draft from absolute short-window handoff.
 * Session approved/baseline is kept for Revert only — not drawn on Hero.
 */
export function buildHeroEvaluationSeries(
  draftPlan: FivePercentPlan,
  panel: SanitizedPanel,
  asOf: { year: number; month: number },
  slackBandPp: number,
): HeroEvaluationSeries {
  const storeIds = draftPlan.projections.map((p) => p.store_id);
  const asOfLabel = periodLabel(asOf.year, asOf.month);
  const periodMap = new Map<string, PeriodPoint>();

  for (const row of panel.rows) {
    if (storeIds.length > 0 && !storeIds.includes(row.store_id)) {
      continue;
    }
    const point = { year: row.year, month: row.month };
    if (atOrBefore(point, asOf)) {
      periodMap.set(periodLabel(point.year, point.month), point);
    }
  }
  for (const point of draftPlan.chain_trajectory) {
    periodMap.set(periodLabel(point.year, point.month), {
      year: point.year,
      month: point.month,
    });
  }
  periodMap.set(asOfLabel, { year: asOf.year, month: asOf.month });

  const periods = [...periodMap.values()].sort(periodCmp);
  const labels = periods.map((p) => periodLabel(p.year, p.month));

  const draftByLabel = new Map(
    draftPlan.chain_trajectory.map((p) => [periodLabel(p.year, p.month), p.score]),
  );

  const factYs = periods.map((p) => {
    if (!atOrBefore(p, asOf)) {
      return null;
    }
    return networkActual(panel, p.year, p.month, storeIds);
  });
  const cumulativeYs = cumulativeMeanSeries(factYs);

  const windowStart = shiftCalendarMonths(
    asOf.year,
    asOf.month,
    -CUMULATIVE_WINDOW_LAG_MONTHS,
  );
  const windowStartLabel = periodLabel(windowStart.year, windowStart.month);
  // Null months before window start so the running mean resets at as-of − lag.
  const windowFactYs = periods.map((p, i) => {
    const fact = factYs[i];
    if (fact == null || periodCmp(p, windowStart) < 0) {
      return null;
    }
    return fact;
  });
  const windowFactCumYs = cumulativeMeanSeries(windowFactYs);

  // Green monthly: window facts, then pure draft on the horizon.
  const planMonthlyYs = periods.map((p, i) => {
    const windowFact = windowFactYs[i];
    if (windowFact != null) {
      return windowFact;
    }
    const key = periodLabel(p.year, p.month);
    if (draftByLabel.has(key)) {
      return draftByLabel.get(key)!;
    }
    return null;
  });
  const absoluteWindowCumYs = cumulativeMeanSeries(planMonthlyYs);

  const draftYs = periods.map((p) => {
    if (!atOrAfter(p, asOf)) {
      return null;
    }
    const key = periodLabel(p.year, p.month);
    if (draftByLabel.has(key)) {
      return draftByLabel.get(key)!;
    }
    if (key === asOfLabel) {
      return draftPlan.current_chain;
    }
    return null;
  });

  // Last window *fact* point = absolute handoff for blue / green / orange start.
  let handoffIdx = -1;
  for (let i = 0; i < periods.length; i += 1) {
    if (atOrBefore(periods[i], asOf) && windowFactYs[i] != null) {
      handoffIdx = i;
    }
  }
  if (handoffIdx >= 0 && absoluteWindowCumYs[handoffIdx] != null) {
    draftYs[handoffIdx] = absoluteWindowCumYs[handoffIdx];
  }

  const planCumulativeYs = absoluteWindowCumYs.map((value, i) => {
    if (handoffIdx < 0 || i < handoffIdx) {
      return null;
    }
    return value;
  });

  // Orange: short-window actual through handoff, then linear path to target on horizon.
  const horizonIdxs: number[] = [];
  if (handoffIdx >= 0) {
    for (let i = handoffIdx + 1; i < periods.length; i += 1) {
      horizonIdxs.push(i);
    }
  }
  const startCum =
    handoffIdx >= 0 && windowFactCumYs[handoffIdx] != null
      ? windowFactCumYs[handoffIdx]!
      : null;
  const pathToTarget =
    startCum == null
      ? []
      : linearCumulativePathToTarget(startCum, draftPlan.target, horizonIdxs.length);
  const pathByIdx = new Map(horizonIdxs.map((idx, k) => [idx, pathToTarget[k]!]));

  const windowCumulativeYs = periods.map((_p, i) => {
    if (handoffIdx >= 0 && i === handoffIdx) {
      return startCum;
    }
    if (pathByIdx.has(i)) {
      return pathByIdx.get(i)!;
    }
    if (handoffIdx >= 0 && i > handoffIdx) {
      return null;
    }
    return windowFactCumYs[i];
  });

  const upperYs = draftYs.map((v) => (v == null ? null : Math.min(100, v + slackBandPp)));
  const lowerYs = draftYs.map((v) => (v == null ? null : Math.max(0, v - slackBandPp)));

  return {
    labels,
    factYs,
    cumulativeYs,
    windowCumulativeYs,
    planCumulativeYs,
    draftYs,
    upperYs,
    lowerYs,
    target: draftPlan.target,
    asOfLabel,
    windowStartLabel,
  };
}
