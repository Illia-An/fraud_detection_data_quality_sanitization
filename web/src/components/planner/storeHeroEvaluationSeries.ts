/** Store-level evaluation series — same grammar as network Hero (per-store zoom). */

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import {
  applyDraftLastMonthToGapModel,
  buildMonitoringPlanActualGapModel,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { cumulativeMeanSeries } from './heroEvaluationSeries';

export interface StoreHeroEvaluationSeries {
  labels: string[];
  /** Monthly store fact ≤ as-of (Hero black). */
  actualYs: (number | null)[];
  /** Monthly store plan; purple handoff then plan months (Hero blue). */
  planYs: (number | null)[];
  /** Running mean of store actuals ≤ as-of (Hero purple). */
  cumulativeYs: (number | null)[];
  /**
   * Continues from cumulative actual: fact months, then store plan months
   * (YTD if this store's draft lands). Drawn from purple handoff onward (Hero green).
   */
  planCumulativeYs: (number | null)[];
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
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.five_percent ?? null;
}

/**
 * Same Evaluation grammar as network Hero, scoped to one store.
 * Timeline = store panel months ≤ as-of ∪ plan trajectory (fact history + plan).
 * Optional sandbox draftLast patches the last estimate month (ephemeral).
 * Gap model stays plan-horizon only (Inspect table / deviation caption).
 */
export function buildStoreHeroEvaluationSeries(
  plan: FivePercentPlan,
  storeId: number,
  panel: SanitizedPanel,
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
    if (atOrBefore(point, asOf)) {
      periodMap.set(periodLabel(point.year, point.month), point);
    }
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

  const actualYs = periods.map((p) => {
    if (!atOrBefore(p, asOf)) {
      return null;
    }
    return storeActual(panel, storeId, p.year, p.month);
  });
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

  const planHandoffMonthlyYs = periods.map((_, i) => {
    const fact = actualYs[i];
    if (fact != null) {
      return fact;
    }
    return planYs[i];
  });
  const planCumulativeFull = cumulativeMeanSeries(planHandoffMonthlyYs);

  let handoffIdx = -1;
  for (let i = cumulativeYs.length - 1; i >= 0; i -= 1) {
    if (cumulativeYs[i] != null) {
      handoffIdx = i;
      break;
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

  return {
    labels,
    actualYs,
    planYs,
    cumulativeYs,
    planCumulativeYs,
    target: plan.target,
    asOfLabel,
    asOfIndex: asOfIdxOnTimeline >= 0 ? asOfIdxOnTimeline : null,
    deviation: model.deviation,
    storeId: model.storeId,
  };
}
