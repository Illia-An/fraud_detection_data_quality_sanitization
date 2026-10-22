import type { MessageKey } from '../../i18n';
import {
  TTS_PLAN_HORIZON_MAX,
  TTS_PLAN_HORIZON_MIN,
  TTS_PLAN_TARGET_MAX,
  TTS_PLAN_TARGET_MIN,
} from '../../schemas/ttsPlan';

/** Run-button guards for the TTS planner. Improvement is a lower minute value. */

export type TtsPlannerRunBlockReason =
  | 'no_baseline'
  | 'no_stores'
  | 'target_above_current'
  | 'target_out_of_range'
  | 'cap_too_tight'
  | 'horizon_invalid'
  | 'running'
  | null;

export function ttsPlannerRunBlockReason(input: {
  baselineReady: boolean;
  storeCount: number;
  currentChain: number | null;
  target: number;
  horizon: number;
  maxMonthlyImprove: number;
  isPending: boolean;
}): TtsPlannerRunBlockReason {
  if (input.isPending) {
    return 'running';
  }
  if (!input.baselineReady) {
    return 'no_baseline';
  }
  if (input.storeCount < 1) {
    return 'no_stores';
  }
  if (input.horizon < TTS_PLAN_HORIZON_MIN || input.horizon > TTS_PLAN_HORIZON_MAX) {
    return 'horizon_invalid';
  }
  if (
    Number.isNaN(input.target) ||
    input.target < TTS_PLAN_TARGET_MIN ||
    input.target > TTS_PLAN_TARGET_MAX
  ) {
    return 'target_out_of_range';
  }
  if (input.currentChain != null && input.target > input.currentChain + 1e-9) {
    return 'target_above_current';
  }
  if (
    input.currentChain != null &&
    input.maxMonthlyImprove > 0 &&
    input.currentChain - input.target > input.horizon * input.maxMonthlyImprove + 1e-9
  ) {
    return 'cap_too_tight';
  }
  return null;
}

export const TTS_PLANNER_RUN_BLOCK_MESSAGE_KEYS: Record<
  Exclude<TtsPlannerRunBlockReason, null>,
  MessageKey
> = {
  no_baseline: 'ttsPlanner.block.noBaseline',
  no_stores: 'ttsPlanner.block.noStores',
  target_above_current: 'ttsPlanner.block.targetAbove',
  target_out_of_range: 'ttsPlanner.block.targetRange',
  cap_too_tight: 'ttsPlanner.block.capTight',
  horizon_invalid: 'ttsPlanner.block.horizon',
  running: 'ttsPlanner.block.running',
};
