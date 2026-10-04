/**
 * One-click Planner scenario packs — recipes over existing levers + optional
 * surplus→behind post-pass (session draft only).
 */

import { buildPlanMonitoringInsights } from './planMonitoring';
import {
  DEFAULT_PLAN_PARAMS,
  type FivePercentPlan,
  type PlanParams,
} from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import {
  redistributeSurplusToBehind,
  type SurplusRedistributeResult,
} from './surplusRedistribute';

export type ScenarioPackId = 'close_gap' | 'rebalance' | 'steady_grind';

export interface ScenarioPackSurplus {
  clawbackDonors: boolean;
  harvestFraction: number;
  topDonors: number;
  topReceivers: number;
}

export interface ScenarioPackRecipe {
  id: ScenarioPackId;
  /** Allocator levers applied before Run. */
  params: PlanParams;
  /** After Run: surplus redistribute; null = steady grind (levers only). */
  surplus: ScenarioPackSurplus | null;
}

const SURPLUS_DEFAULTS: Omit<ScenarioPackSurplus, 'clawbackDonors'> = {
  harvestFraction: 0.5,
  topDonors: 10,
  topReceivers: 10,
};

/** v1 packs: Close the gap · Rebalance · Steady grind. */
export const SCENARIO_PACKS: readonly ScenarioPackRecipe[] = [
  {
    id: 'close_gap',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'uniform',
      priority_power: 1.5,
    },
    surplus: { ...SURPLUS_DEFAULTS, clawbackDonors: false },
  },
  {
    id: 'rebalance',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'uniform',
      priority_power: 1.5,
    },
    surplus: { ...SURPLUS_DEFAULTS, clawbackDonors: true },
  },
  {
    id: 'steady_grind',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'uniform',
      priority_power: 1,
    },
    surplus: null,
  },
] as const;

export function getScenarioPack(id: ScenarioPackId): ScenarioPackRecipe {
  const pack = SCENARIO_PACKS.find((p) => p.id === id);
  if (!pack) {
    throw new Error(`Unknown scenario pack: ${id}`);
  }
  return pack;
}

/**
 * Optional surplus→behind pass after a fresh Run.
 * Returns the input plan unchanged when there is no ahead/behind split.
 */
export function applyScenarioSurplusPass(
  plan: FivePercentPlan,
  panel: SanitizedPanel,
  asOf: { year: number; month: number },
  surplus: ScenarioPackSurplus,
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
