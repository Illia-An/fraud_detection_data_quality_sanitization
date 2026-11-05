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
   * Monthly scores after the last cleansed fact that carry the −3 window mean to target.
   * Stitches that last fact. Capped at the plan target month. Orange stays on as-of.
   */
  requiredMonthlyYs: (number | null)[];
  /**
   * Running mean of facts from the −3 marker through the last fact, then required
   * monthlies through the plan target month. Visible across the window, not only after as-of.
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

export interface RequiredScorePair {
  requiredMonthlyYs: (number | null)[];
  requiredCumulativeYs: (number | null)[];
}

function emptyRequiredPair(length: number): RequiredScorePair {
  const blank = (): (number | null)[] => Array.from({ length }, () => null);
  return { requiredMonthlyYs: blank(), requiredCumulativeYs: blank() };
}

/**
 * Plan (−3) required pair, drawn like Pressure.
 * Knowledge is cleansed fact from `windowStart` through the last fact, including
 * months after as-of. Cumulative shows that running mean, then required monthlies
 * through `horizonEnd` (axis end when null). Monthly stitches the last fact and
 * continues only after it. Facts before `windowStart` are ignored.
 */
export function requiredPairFromWindowThroughLastFact(
  periods: PeriodPoint[],
  factYs: (number | null)[],
  windowStart: PeriodPoint,
  target: number,
  horizonEnd: PeriodPoint | null,
): RequiredScorePair {
  const length = periods.length;
  if (factYs.length !== length) {
    return emptyRequiredPair(length);
  }

  let lastFactIdx = -1;
  for (let i = 0; i < length; i += 1) {
    if (factYs[i] != null) {
      lastFactIdx = i;
    }
  }
  if (lastFactIdx < 0) {
    return emptyRequiredPair(length);
  }

  let horizonEndIdx = length - 1;
  if (horizonEnd != null) {
    horizonEndIdx = -1;
    for (let i = 0; i < length; i += 1) {
      if (periodCmp(periods[i]!, horizonEnd) <= 0) {
        horizonEndIdx = i;
      }
    }
    if (horizonEndIdx < 0) {
      return emptyRequiredPair(length);
    }
  }

  const knowledgeYs = periods.map((period, i) => {
    const fact = factYs[i];
    if (fact == null || i > lastFactIdx || periodCmp(period, windowStart) < 0) {
      return null;
    }
    return fact;
  });

  let handoffCount = 0;
  for (let i = 0; i <= lastFactIdx; i += 1) {
    if (knowledgeYs[i] != null) {
      handoffCount += 1;
    }
  }
  const startCum = cumulativeMeanSeries(knowledgeYs)[lastFactIdx];
  if (startCum == null || handoffCount < 1) {
    return emptyRequiredPair(length);
  }

  const horizonIdxs: number[] = [];
  for (let i = lastFactIdx + 1; i <= horizonEndIdx; i += 1) {
    horizonIdxs.push(i);
  }
  const pathToTarget = linearCumulativePathToTarget(startCum, target, horizonIdxs.length);
  const requiredMonthlies = monthlyFromCumulativePath(startCum, handoffCount, pathToTarget);
  const requiredByIdx = new Map(horizonIdxs.map((idx, k) => [idx, requiredMonthlies[k]!]));

  const requiredMonthlyYs = periods.map((_period, i) => {
    if (requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    if (i === lastFactIdx) {
      return factYs[i];
    }
    return null;
  });

  const requiredPlanMonthlyYs = periods.map((_period, i) => {
    if (i > lastFactIdx && requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    return knowledgeYs[i];
  });
  const requiredCumFull = cumulativeMeanSeries(requiredPlanMonthlyYs);
  const requiredCumulativeYs = requiredCumFull.map((value, i) => {
    if (value == null || i > horizonEndIdx) {
      return null;
    }
    return value;
  });

  return { requiredMonthlyYs, requiredCumulativeYs };
}

function trajectoryHorizonEnd(
  trajectory: { year: number; month: number }[],
): PeriodPoint | null {
  if (trajectory.length === 0) {
    return null;
  }
  const last = trajectory[trajectory.length - 1]!;
  return { year: last.year, month: last.month };
}

/**
 * Timeline = cleansed panel months (incl. after as-of) ∪ plan trajectory (horizon).
 * Fact / full cumulative (purple): realized panel scores wherever present.
 * Orange / green / draft handoff stays at as-of and ignores post-as-of fact.
 * Orange: short-window actual mean, then linear cumulative path that reaches target.
 * Green: short-window + pure draft cumulative (what the draft actually scores).
 * Required pair: Pressure grammar on the −3 window — cumulative from the marker
 * through the last fact, monthly from that last fact through the plan target month.
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

  const requiredPair = requiredPairFromWindowThroughLastFact(
    periods,
    factYs,
    windowStart,
    draftPlan.target,
    trajectoryHorizonEnd(draftPlan.chain_trajectory),
  );
  const requiredMonthlyYs = requiredPair.requiredMonthlyYs;
  const requiredCumulativeYs = requiredPair.requiredCumulativeYs;

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
