/** Build Evaluation-View series for the Planner hero (fact | as-of | forecast). */

import { periodLabel } from '../../schemas/plan';
import { metricScore, type DirectedPlan, type MetricScorePanel } from '../../schemas/metricScore';

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
  /**
   * Monthly scores after as-of that make the short-window cumulative (green grammar)
   * follow orange and land on target. Not fact — inverted from Path to target (−3 mo).
   * Stitches the last window fact at handoff for continuity with black.
   */
  requiredMonthlyYs: (number | null)[];
  /**
   * Cumulative of (short-window facts + required monthlies) — twin of gray dashed.
   * Lands on target by construction; orange stays the independent linear path.
   */
  requiredCumulativeYs: (number | null)[];
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
  panel: MetricScorePanel,
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
    const score = metricScore(row);
    if (score != null) {
      scores.push(score);
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
 * Invert running-mean cumulative levels into monthly scores.
 * Handoff mean c0 over `startCount` months; then c1…cN:
 * m_k = (n+k)·c_k − (n+k−1)·c_{k−1}.
 */
export function monthlyFromCumulativePath(
  startCum: number,
  startCount: number,
  cumulativePath: number[],
): number[] {
  if (startCount < 1) {
    throw new Error('startCount must be >= 1');
  }
  const out: number[] = [];
  let prevCum = startCum;
  let prevCount = startCount;
  for (const nextCum of cumulativePath) {
    const nextCount = prevCount + 1;
    out.push(roundPct(nextCount * nextCum - prevCount * prevCum));
    prevCum = nextCum;
    prevCount = nextCount;
  }
  return out;
}

/**
 * Timeline = cleansed panel months (incl. after as-of) ∪ plan trajectory (horizon).
 * Fact / full cumulative (purple): realized panel scores wherever present.
 * Planning handoff stays at as-of: short-window / required / draft ignore post-as-of fact.
 * Orange: short-window actual mean, then linear cumulative path that reaches target.
 * Green: short-window + pure draft cumulative (what the draft actually scores).
 * Required monthly (dashed near-black): monthlies that make green grammar hit target.
 * Required cumulative (solid near-black): cum of window facts + required monthlies → target.
 * Blue / cone: monthly draft from absolute short-window handoff.
 * Session approved/baseline is kept for Revert only — not drawn on Hero.
 */
export function buildHeroEvaluationSeries(
  draftPlan: DirectedPlan,
  panel: MetricScorePanel,
  asOf: { year: number; month: number },
  slackBandPp: number,
  bounds: { floor?: number; ceiling?: number } = {},
): HeroEvaluationSeries {
  const floor = bounds.floor ?? 0;
  const ceiling = bounds.ceiling ?? 100;
  const storeIds = draftPlan.projections.map((p) => p.store_id);
  const asOfLabel = periodLabel(asOf.year, asOf.month);
  const periodMap = new Map<string, PeriodPoint>();

  for (const row of panel.rows) {
    if (storeIds.length > 0 && !storeIds.includes(row.store_id)) {
      continue;
    }
    const point = { year: row.year, month: row.month };
    periodMap.set(periodLabel(point.year, point.month), point);
  }
  for (const point of draftPlan.chain_trajectory) {
    periodMap.set(periodLabel(point.year, point.month), {
      year: point.year,
      month: point.month,
    });
  }
  periodMap.set(asOfLabel, { year: asOf.year, month: asOf.month });

  const windowStart = shiftCalendarMonths(
    asOf.year,
    asOf.month,
    -CUMULATIVE_WINDOW_LAG_MONTHS,
  );
  const windowStartLabel = periodLabel(windowStart.year, windowStart.month);
  // Ensure −3 mo window marker has an x category even when panel has no row there.
  periodMap.set(windowStartLabel, windowStart);

  const periods = [...periodMap.values()].sort(periodCmp);
  const labels = periods.map((p) => periodLabel(p.year, p.month));

  const draftByLabel = new Map(
    draftPlan.chain_trajectory.map((p) => [periodLabel(p.year, p.month), p.score]),
  );

  // Realized cleansed fact wherever the panel has it (may continue past as-of).
  const factYs = periods.map((p) => networkActual(panel, p.year, p.month, storeIds));
  const cumulativeYs = cumulativeMeanSeries(factYs);
  // Short-window planning facts: as-of − lag … as-of only (post-as-of fact stays display-only).
  const windowFactYs = periods.map((p, i) => {
    const fact = factYs[i];
    if (fact == null || periodCmp(p, windowStart) < 0 || !atOrBefore(p, asOf)) {
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

  // Required monthly = invert orange so short-window (−3) running mean lands on target.
  let handoffCount = 0;
  if (handoffIdx >= 0) {
    for (let i = 0; i <= handoffIdx; i += 1) {
      if (windowFactYs[i] != null) {
        handoffCount += 1;
      }
    }
  }
  const requiredMonthlies =
    startCum == null || handoffCount < 1 || pathToTarget.length === 0
      ? []
      : monthlyFromCumulativePath(startCum, handoffCount, pathToTarget);
  const requiredByIdx = new Map(horizonIdxs.map((idx, k) => [idx, requiredMonthlies[k]!]));

  const requiredMonthlyYs = periods.map((_p, i) => {
    if (requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    if (handoffIdx >= 0 && i === handoffIdx) {
      return windowFactYs[i];
    }
    return null;
  });

  // Required cumulative = green grammar fed with required monthlies (pair with gray).
  const requiredPlanMonthlyYs = periods.map((_p, i) => {
    if (handoffIdx >= 0 && i > handoffIdx && requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    return windowFactYs[i];
  });
  const requiredCumFull = cumulativeMeanSeries(requiredPlanMonthlyYs);
  const requiredCumulativeYs = requiredCumFull.map((value, i) => {
    if (handoffIdx < 0 || i < handoffIdx) {
      return null;
    }
    return value;
  });

  const upperYs = draftYs.map((v) => (v == null ? null : Math.min(ceiling, v + slackBandPp)));
  const lowerYs = draftYs.map((v) => (v == null ? null : Math.max(floor, v - slackBandPp)));

  return {
    labels,
    factYs,
    cumulativeYs,
    windowCumulativeYs,
    planCumulativeYs,
    draftYs,
    requiredMonthlyYs,
    requiredCumulativeYs,
    upperYs,
    lowerYs,
    target: draftPlan.target,
    asOfLabel,
    windowStartLabel,
  };
}
