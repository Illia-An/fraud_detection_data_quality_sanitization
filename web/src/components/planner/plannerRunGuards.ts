import type { MessageKey } from '../../i18n';

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

export const PLANNER_RUN_BLOCK_MESSAGE_KEYS: Record<
  Exclude<PlannerRunBlockReason, null>,
  MessageKey
> = {
  no_baseline: 'planner.block.noBaseline',
  no_stores: 'planner.block.noStores',
  target_below_current: 'planner.block.targetBelow',
  target_out_of_range: 'planner.block.targetRange',
  cap_too_tight: 'planner.block.capTight',
  horizon_invalid: 'planner.block.horizon',
  running: 'planner.block.running',
};
