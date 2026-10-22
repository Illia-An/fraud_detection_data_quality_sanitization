/** Store-level evaluation series — same grammar as network Hero (per-store zoom). */

import { periodLabel } from '../../schemas/plan';
import {
  applyDraftLastMonthToGapModel,
  buildMonitoringPlanActualGapModel,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { metricScore, type DirectedPlan, type MetricScorePanel } from '../../schemas/metricScore';
import {
  CUMULATIVE_WINDOW_LAG_MONTHS,
  cumulativeMeanSeries,
  linearCumulativePathToTarget,
  monthlyFromCumulativePath,
  shiftCalendarMonths,
} from './heroEvaluationSeries';

export interface StoreHeroEvaluationSeries {
  labels: string[];
  /** Monthly store fact from panel (may continue past as-of). */
  actualYs: (number | null)[];
  /** Monthly store plan; purple handoff then plan months (Hero blue). */
  planYs: (number | null)[];
  /** Running mean of store actuals wherever present (Hero purple). */
  cumulativeYs: (number | null)[];
  /**
   * Continues from cumulative actual at as-of: fact ≤ as-of, then store plan months
   * (YTD if this store's draft lands). Drawn from purple handoff onward (Hero green).
   */
  planCumulativeYs: (number | null)[];
  /**
   * Monthlies after as-of that make short-window (−3) cum hit target (Network gray dash).
   */
  requiredMonthlyYs: (number | null)[];
  /** Cum of short-window facts + required monthlies → target (Network gray solid). */
  requiredCumulativeYs: (number | null)[];
  /** Network/store target line (Hero red). */
  target: number;
  asOfLabel: string | null;
  asOfIndex: number | null;
  deviation: number | null;
  storeId: number;
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

function storeActual(
  panel: MetricScorePanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return metricScore(row);
}

/**
 * Same Evaluation grammar as network Hero, scoped to one store.
 * Timeline = store panel months (incl. after as-of) ∪ plan trajectory.
 * Post-as-of fact is display-only; plan handoff / green stay locked at as-of.
 * Required pair uses short-window (−3 … as-of) like Network Hero.
 * Optional sandbox draftLast patches the last estimate month (ephemeral).
 * Gap model stays plan-horizon only (Inspect table / deviation caption).
 */
export function buildStoreHeroEvaluationSeries(
  plan: DirectedPlan,
  storeId: number,
  panel: MetricScorePanel,
  insights: PlanMonitoringInsights,
  draftLast: number | null = null,
): StoreHeroEvaluationSeries | null {
  const base = buildMonitoringPlanActualGapModel(plan, storeId, panel, insights);
  if (!base) {
    return null;
  }
  const model = applyDraftLastMonthToGapModel(base, draftLast, plan.direction);

  const asOf: PeriodPoint = {
    year: insights.as_of_year,
    month: insights.as_of_month,
  };
  const asOfLabel = periodLabel(asOf.year, asOf.month);

  const periodMap = new Map<string, PeriodPoint>();
  for (const row of panel.rows) {
    if (row.store_id !== storeId) {
      continue;
    }
    const point = { year: row.year, month: row.month };
    periodMap.set(periodLabel(point.year, point.month), point);
  }
  for (const point of plan.chain_trajectory) {
    periodMap.set(periodLabel(point.year, point.month), {
      year: point.year,
      month: point.month,
    });
  }
  periodMap.set(asOfLabel, { year: asOf.year, month: asOf.month });

  const periods = [...periodMap.values()].sort(periodCmp);
  const labels = periods.map((p) => periodLabel(p.year, p.month));

  const planByLabel = new Map(
    model.points.map((p) => [p.label, p.planned] as const).filter(([, v]) => v != null),
  );

  const actualYs = periods.map((p) => storeActual(panel, storeId, p.year, p.month));
  // Prefer monitoring as-of actual when panel cell missing (matches gap caption).
  const asOfIdxOnTimeline = labels.indexOf(asOfLabel);
  if (asOfIdxOnTimeline >= 0 && actualYs[asOfIdxOnTimeline] == null && model.actualAtAsOf != null) {
    actualYs[asOfIdxOnTimeline] = model.actualAtAsOf;
  }

  const cumulativeYs = cumulativeMeanSeries(actualYs);

  const planYs = periods.map((p) => {
    if (!atOrAfter(p, asOf)) {
      return null;
    }
    const key = periodLabel(p.year, p.month);
    if (planByLabel.has(key)) {
      return planByLabel.get(key)!;
    }
    return null;
  });

  // Green grammar: facts ≤ as-of, then plan (ignore realized months after as-of).
  const planHandoffMonthlyYs = periods.map((p, i) => {
    if (atOrBefore(p, asOf) && actualYs[i] != null) {
      return actualYs[i];
    }
    return planYs[i];
  });
  const planCumulativeFull = cumulativeMeanSeries(planHandoffMonthlyYs);

  let handoffIdx = -1;
  for (let i = 0; i < periods.length; i += 1) {
    if (atOrBefore(periods[i], asOf) && cumulativeYs[i] != null) {
      handoffIdx = i;
    }
  }

  // Blue continues purple (Hero draft handoff) — gap stays in caption.
  if (handoffIdx >= 0) {
    planYs[handoffIdx] = cumulativeYs[handoffIdx];
  }

  const planCumulativeYs = planCumulativeFull.map((value, i) => {
    if (handoffIdx < 0 || i < handoffIdx) {
      return null;
    }
    if (i === handoffIdx) {
      return cumulativeYs[handoffIdx];
    }
    return value;
  });

  // Required pair — short-window (−3 … as-of), same invert as Network Hero.
  const windowStart = shiftCalendarMonths(
    asOf.year,
    asOf.month,
    -CUMULATIVE_WINDOW_LAG_MONTHS,
  );
  const windowFactYs = periods.map((p, i) => {
    const fact = actualYs[i];
    if (fact == null || periodCmp(p, windowStart) < 0 || !atOrBefore(p, asOf)) {
      return null;
    }
    return fact;
  });
  const windowFactCumYs = cumulativeMeanSeries(windowFactYs);

  let requiredHandoffIdx = -1;
  for (let i = 0; i < periods.length; i += 1) {
    if (atOrBefore(periods[i], asOf) && windowFactYs[i] != null) {
      requiredHandoffIdx = i;
    }
  }

  const horizonIdxs: number[] = [];
  if (requiredHandoffIdx >= 0) {
    for (let i = requiredHandoffIdx + 1; i < periods.length; i += 1) {
      horizonIdxs.push(i);
    }
  }
  const startCum =
    requiredHandoffIdx >= 0 && windowFactCumYs[requiredHandoffIdx] != null
      ? windowFactCumYs[requiredHandoffIdx]!
      : null;

  let handoffCount = 0;
  if (requiredHandoffIdx >= 0) {
    for (let i = 0; i <= requiredHandoffIdx; i += 1) {
      if (windowFactYs[i] != null) {
        handoffCount += 1;
      }
    }
  }
  const pathToTarget =
    startCum == null
      ? []
      : linearCumulativePathToTarget(startCum, plan.target, horizonIdxs.length);
  const requiredMonthlies =
    startCum == null || handoffCount < 1 || pathToTarget.length === 0
      ? []
      : monthlyFromCumulativePath(startCum, handoffCount, pathToTarget);
  const requiredByIdx = new Map(horizonIdxs.map((idx, k) => [idx, requiredMonthlies[k]!]));

  const requiredMonthlyYs = periods.map((_p, i) => {
    if (requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    if (requiredHandoffIdx >= 0 && i === requiredHandoffIdx) {
      return windowFactYs[i];
    }
    return null;
  });

  const requiredPlanMonthlyYs = periods.map((_p, i) => {
    if (requiredHandoffIdx >= 0 && i > requiredHandoffIdx && requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    return windowFactYs[i];
  });
  const requiredCumFull = cumulativeMeanSeries(requiredPlanMonthlyYs);
  const requiredCumulativeYs = requiredCumFull.map((value, i) => {
    if (requiredHandoffIdx < 0 || i < requiredHandoffIdx) {
      return null;
    }
    return value;
  });

  return {
    labels,
    actualYs,
    planYs,
    cumulativeYs,
    planCumulativeYs,
    requiredMonthlyYs,
    requiredCumulativeYs,
    target: plan.target,
    asOfLabel,
    asOfIndex: asOfIdxOnTimeline >= 0 ? asOfIdxOnTimeline : null,
    deviation: model.deviation,
    storeId: model.storeId,
  };
}
