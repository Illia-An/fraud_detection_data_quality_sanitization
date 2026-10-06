/**
 * Preset questions for the network path — each pack is a question + PlanParams recipe.
 * One click: set levers + Run; canvas draft is the answer (session only).
 * Store mix / surplus stays in the EXP redistribute block (group B).
 */

import {
  DEFAULT_PLAN_PARAMS,
  type PlanParams,
} from './plan';

export type ScenarioPackId = 'close_gap' | 'steady_grind' | 'front_loaded';

export interface ScenarioPackRecipe {
  id: ScenarioPackId;
  /** Allocator levers applied before Run. */
  params: PlanParams;
}

/** Exp 1: network path only — Close · Steady · Front-loaded. */
export const SCENARIO_PACKS: readonly ScenarioPackRecipe[] = [
  {
    id: 'close_gap',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'uniform',
      priority_power: 1.5,
    },
  },
  {
    id: 'steady_grind',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'uniform',
      priority_power: 1,
    },
  },
  {
    id: 'front_loaded',
    params: {
      ...DEFAULT_PLAN_PARAMS,
      trajectory: 'front_loaded',
      trajectory_power: 2,
      priority_power: 1,
    },
  },
] as const;

export function getScenarioPack(id: ScenarioPackId): ScenarioPackRecipe {
  const pack = SCENARIO_PACKS.find((p) => p.id === id);
  if (!pack) {
    throw new Error(`Unknown scenario pack: ${id}`);
  }
  return pack;
}
