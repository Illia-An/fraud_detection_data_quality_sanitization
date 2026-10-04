/** Store-level evaluation series for Inspect (EXP: clawback readability). */

import type { FivePercentPlan } from '../../schemas/plan';
import {
  applyDraftLastMonthToGapModel,
  buildMonitoringPlanActualGapModel,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

export interface StoreHeroEvaluationSeries {
  labels: string[];
  actualYs: (number | null)[];
  planYs: (number | null)[];
  chainYs: (number | null)[];
  asOfLabel: string | null;
  asOfIndex: number | null;
  deviation: number | null;
  storeId: number;
}

/**
 * Fact / store plan / network chain aligned to plan horizon.
 * Optional sandbox draftLast patches the last estimate month (ephemeral).
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
  const asOfPoint =
    model.asOfIndex != null ? model.points[model.asOfIndex] ?? null : null;

  return {
    labels: model.points.map((p) => p.label),
    actualYs: model.points.map((p) => p.actual),
    planYs: model.points.map((p) => p.planned),
    chainYs: model.points.map((p) => p.chain),
    asOfLabel: asOfPoint?.label ?? null,
    asOfIndex: model.asOfIndex,
    deviation: model.deviation,
    storeId: model.storeId,
  };
}
