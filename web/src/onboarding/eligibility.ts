import type { TourStepConfig } from './tourConfig';

export interface OnboardingProductState {
  hasProcessResult: boolean;
  hasPlannerPanel: boolean;
  /** True after Planner Run produced a draft (At-risk / Inspect steps). */
  hasDraftPlan: boolean;
}

/** Whether a step should appear given current product state. */
export function isStepEligible(
  step: TourStepConfig,
  state: OnboardingProductState,
): boolean {
  if (step.requires === 'processResult') {
    return state.hasProcessResult;
  }
  if (step.requires === 'plannerPanel') {
    return state.hasPlannerPanel;
  }
  if (step.requires === 'draftPlan') {
    return state.hasDraftPlan;
  }
  return true;
}

/** Ordered eligible steps for the current product state. */
export function eligibleSteps(
  steps: TourStepConfig[],
  state: OnboardingProductState,
): TourStepConfig[] {
  return steps.filter((step) => isStepEligible(step, state));
}

/**
 * Resolve the next eligible step after `fromId` (exclusive).
 * Returns null when the tour should complete.
 */
export function nextEligibleStepId(
  steps: TourStepConfig[],
  fromId: string | null,
  state: OnboardingProductState,
): string | null {
  const eligible = eligibleSteps(steps, state);
  if (eligible.length === 0) {
    return null;
  }
  if (fromId == null) {
    return eligible[0]!.id;
  }
  const fromIndex = eligible.findIndex((step) => step.id === fromId);
  if (fromIndex < 0) {
    return eligible[0]!.id;
  }
  const next = eligible[fromIndex + 1];
  return next?.id ?? null;
}

export function prevEligibleStepId(
  steps: TourStepConfig[],
  fromId: string,
  state: OnboardingProductState,
): string | null {
  const eligible = eligibleSteps(steps, state);
  const fromIndex = eligible.findIndex((step) => step.id === fromId);
  if (fromIndex <= 0) {
    return null;
  }
  return eligible[fromIndex - 1]!.id;
}

export function progressForStep(
  steps: TourStepConfig[],
  stepId: string,
  state: OnboardingProductState,
): { current: number; total: number } {
  const eligible = eligibleSteps(steps, state);
  const index = eligible.findIndex((step) => step.id === stepId);
  return {
    current: index >= 0 ? index + 1 : 1,
    total: Math.max(eligible.length, 1),
  };
}
