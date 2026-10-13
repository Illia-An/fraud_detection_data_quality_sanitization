import type { MessageKey } from '../i18n';

/** Stable tour identity — bump ONBOARDING_TOUR_VERSION when step IDs change. */
export const ONBOARDING_TOUR_ID = 'planner-product-tour';
export const ONBOARDING_TOUR_VERSION = 3;

export type OnboardingAnchorId =
  | 'nav-main'
  | 'nav-planner'
  | 'sanitization-sample'
  | 'sanitization-controls'
  | 'sanitization-results'
  | 'sanitization-inspect'
  | 'planner-hero'
  | 'planner-levers'
  | 'planner-at-risk'
  | 'planner-inspect';

export type OnboardingStepId =
  | 'welcome'
  | 'workspace'
  | 'sanitization-intro'
  | 'sanitization-controls'
  | 'sanitization-results'
  | 'sanitization-inspect'
  | 'planner-entry'
  | 'planner-hero'
  | 'planner-levers'
  | 'planner-at-risk'
  | 'planner-inspect'
  | 'complete';

export type TourPlacement = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface TourStepConfig {
  id: OnboardingStepId;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /** When set, spotlight this `[data-onboarding]` node. */
  anchor?: OnboardingAnchorId;
  placement: TourPlacement;
  /** Navigate here before showing the step (if not already on path). */
  route?: '/' | '/planner';
  /**
   * Soft eligibility — when false, step is skipped unless it is welcome/complete.
   * Evaluated at runtime against product state.
   */
  requires?: 'processResult' | 'plannerPanel' | 'draftPlan';
}

export const TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'welcome',
    titleKey: 'onboarding.welcome.title',
    bodyKey: 'onboarding.welcome.body',
    placement: 'center',
  },
  {
    id: 'workspace',
    titleKey: 'onboarding.workspace.title',
    bodyKey: 'onboarding.workspace.body',
    anchor: 'nav-main',
    placement: 'right',
    route: '/',
  },
  {
    id: 'sanitization-intro',
    titleKey: 'onboarding.sanitizationIntro.title',
    bodyKey: 'onboarding.sanitizationIntro.body',
    anchor: 'sanitization-sample',
    placement: 'right',
    route: '/',
  },
  {
    id: 'sanitization-controls',
    titleKey: 'onboarding.sanitizationControls.title',
    bodyKey: 'onboarding.sanitizationControls.body',
    anchor: 'sanitization-controls',
    placement: 'right',
    route: '/',
  },
  {
    id: 'sanitization-results',
    titleKey: 'onboarding.sanitizationResults.title',
    bodyKey: 'onboarding.sanitizationResults.body',
    anchor: 'sanitization-results',
    placement: 'left',
    route: '/',
    requires: 'processResult',
  },
  {
    id: 'sanitization-inspect',
    titleKey: 'onboarding.sanitizationInspect.title',
    bodyKey: 'onboarding.sanitizationInspect.body',
    anchor: 'sanitization-inspect',
    placement: 'bottom',
    route: '/',
    requires: 'processResult',
  },
  {
    id: 'planner-entry',
    titleKey: 'onboarding.plannerEntry.title',
    bodyKey: 'onboarding.plannerEntry.body',
    anchor: 'nav-planner',
    placement: 'right',
    route: '/',
  },
  {
    id: 'planner-hero',
    titleKey: 'onboarding.plannerHero.title',
    bodyKey: 'onboarding.plannerHero.body',
    anchor: 'planner-hero',
    placement: 'bottom',
    route: '/planner',
  },
  {
    id: 'planner-levers',
    titleKey: 'onboarding.plannerLevers.title',
    bodyKey: 'onboarding.plannerLevers.body',
    anchor: 'planner-levers',
    placement: 'right',
    route: '/planner',
  },
  {
    id: 'planner-at-risk',
    titleKey: 'onboarding.plannerAtRisk.title',
    bodyKey: 'onboarding.plannerAtRisk.body',
    anchor: 'planner-at-risk',
    placement: 'top',
    route: '/planner',
    requires: 'draftPlan',
  },
  {
    id: 'planner-inspect',
    titleKey: 'onboarding.plannerInspect.title',
    bodyKey: 'onboarding.plannerInspect.body',
    anchor: 'planner-inspect',
    placement: 'top',
    route: '/planner',
    requires: 'draftPlan',
  },
  {
    id: 'complete',
    titleKey: 'onboarding.complete.title',
    bodyKey: 'onboarding.complete.body',
    placement: 'center',
    route: '/',
  },
];

export function stepIndexById(stepId: OnboardingStepId): number {
  return TOUR_STEPS.findIndex((step) => step.id === stepId);
}

export function getStepById(stepId: OnboardingStepId): TourStepConfig | undefined {
  return TOUR_STEPS.find((step) => step.id === stepId);
}

/** Mirror horizontal card placement for RTL so the tooltip stays on the open side of the target. */
export function resolveTourPlacement(
  placement: TourPlacement,
  direction: 'ltr' | 'rtl',
): TourPlacement {
  if (direction !== 'rtl') {
    return placement;
  }
  if (placement === 'left') {
    return 'right';
  }
  if (placement === 'right') {
    return 'left';
  }
  return placement;
}
