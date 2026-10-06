/**
 * Optional surplus→behind pass after Run (group B — not part of network packs).
 */

import { buildPlanMonitoringInsights } from './planMonitoring';
import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import {
  redistributeSurplusToBehind,
  type SurplusRedistributeResult,
} from './surplusRedistribute';

export interface ScenarioSurplusPassOptions {
  clawbackDonors: boolean;
  harvestFraction: number;
  topDonors: number;
  topReceivers: number;
}

export const DEFAULT_SURPLUS_PASS: ScenarioSurplusPassOptions = {
  harvestFraction: 0.5,
  topDonors: 10,
  topReceivers: 10,
  clawbackDonors: false,
};

/**
 * Surplus→behind pass after a fresh Run.
 * Returns the input plan unchanged when there is no ahead/behind split.
 */
export function applyScenarioSurplusPass(
  plan: FivePercentPlan,
  panel: SanitizedPanel,
  asOf: { year: number; month: number },
  surplus: ScenarioSurplusPassOptions,
): { plan: FivePercentPlan; applied: boolean; result: SurplusRedistributeResult | null } {
  const insights = buildPlanMonitoringInsights(plan, panel, asOf);
  if (insights.summary.ahead <= 0 || insights.summary.behind <= 0) {
    return { plan, applied: false, result: null };
  }
  const result = redistributeSurplusToBehind(plan, insights, {
    topDonors: surplus.topDonors,
    topReceivers: surplus.topReceivers,
    harvestFraction: surplus.harvestFraction,
    clawbackDonors: surplus.clawbackDonors,
    asOfYear: asOf.year,
    asOfMonth: asOf.month,
  });
  return { plan: result.plan, applied: true, result };
}
