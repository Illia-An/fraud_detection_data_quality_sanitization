/** Run-button guard reasons for Planner (V4.2 Step 4). */

export type PlannerRunBlockReason =
  | 'no_baseline'
  | 'no_stores'
  | 'target_below_current'
  | 'target_out_of_range'
  | 'cap_too_tight'
  | 'horizon_invalid'
  | 'running'
  | null;

export function plannerRunBlockReason(input: {
  baselineReady: boolean;
  storeCount: number;
  currentChain: number | null;
  target: number;
  horizon: number;
  maxMonthlyImprove: number;
  isPending: boolean;
}): PlannerRunBlockReason {
  if (input.isPending) {
    return 'running';
  }
  if (!input.baselineReady) {
    return 'no_baseline';
  }
  if (input.storeCount < 1) {
    return 'no_stores';
  }
  if (input.horizon < 1 || input.horizon > 60) {
    return 'horizon_invalid';
  }
  if (Number.isNaN(input.target) || input.target < 0 || input.target > 100) {
    return 'target_out_of_range';
  }
  if (input.currentChain != null && input.target < input.currentChain - 1e-9) {
    return 'target_below_current';
  }
  if (
    input.currentChain != null &&
    input.maxMonthlyImprove > 0 &&
    input.target - input.currentChain > input.horizon * input.maxMonthlyImprove + 1e-9
  ) {
    return 'cap_too_tight';
  }
  return null;
}

export const PLANNER_RUN_BLOCK_TOOLTIPS: Record<Exclude<PlannerRunBlockReason, null>, string> = {
  no_baseline: 'Run Sanitization first to build a cleansed Q10012 baseline.',
  no_stores: 'No stores at the selected reference month — pick another period.',
  target_below_current: 'Target must be at or above the current chain score (higher-is-better).',
  target_out_of_range: 'Target must be between 0 and 100%.',
  cap_too_tight:
    'Required lift exceeds Months × Max monthly improve — raise the cap or horizon, or lower Target.',
  horizon_invalid: 'Months must be between 1 and 60.',
  running: 'Simulation is running…',
};
