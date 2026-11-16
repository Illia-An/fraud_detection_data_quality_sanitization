import { useEffect } from 'react';

import { useOnboardingStore } from '../../onboarding';

/** Delay so the accordion / rail can settle before the tour target is scrolled into view. */
const ONBOARDING_SCROLL_DELAY_MS = 80;

export type PlannerOnboardingPrefix = 'planner' | 'tts-planner';

interface PlannerOnboardingShellArgs {
  /** Tour step-id prefix and `data-onboarding` namespace of the page. */
  prefix: PlannerOnboardingPrefix;
  setControlsOpen: (open: boolean) => void;
  setAtRiskExpanded: (expanded: boolean) => void;
}

function scrollToTourTarget(
  target: string,
  options: ScrollIntoViewOptions,
): void {
  document
    .querySelector<HTMLElement>(`[data-onboarding="${target}"]`)
    ?.scrollIntoView(options);
}

/**
 * Expand/collapse the controls rail and the At-risk sheet so tour targets stay
 * visible without covering Hero on Back. Shared by Planner and TTS planner.
 */
export function usePlannerOnboardingShell({
  prefix,
  setControlsOpen,
  setAtRiskExpanded,
}: PlannerOnboardingShellArgs): void {
  const onboardingStatus = useOnboardingStore((s) => s.status);
  const onboardingStepId = useOnboardingStore((s) => s.stepId);

  useEffect(() => {
    if (onboardingStatus !== 'active') {
      return;
    }
    if (onboardingStepId === `${prefix}-levers`) {
      setControlsOpen(true);
      setAtRiskExpanded(false);
      return;
    }
    if (onboardingStepId === `${prefix}-hero`) {
      setAtRiskExpanded(false);
      const timerId = window.setTimeout(() => {
        scrollToTourTarget(`${prefix}-hero`, { block: 'center', behavior: 'auto' });
      }, ONBOARDING_SCROLL_DELAY_MS);
      return () => window.clearTimeout(timerId);
    }
    if (onboardingStepId === `${prefix}-at-risk` || onboardingStepId === `${prefix}-inspect`) {
      setAtRiskExpanded(true);
      // After Accordion opens, bring the sheet into view for spotlight.
      const timerId = window.setTimeout(() => {
        scrollToTourTarget(`${prefix}-at-risk`, { block: 'end', behavior: 'smooth' });
        if (onboardingStepId === `${prefix}-inspect`) {
          scrollToTourTarget(`${prefix}-inspect`, { block: 'center', behavior: 'smooth' });
        }
      }, ONBOARDING_SCROLL_DELAY_MS);
      return () => window.clearTimeout(timerId);
    }
  }, [onboardingStatus, onboardingStepId, prefix, setAtRiskExpanded, setControlsOpen]);
}
