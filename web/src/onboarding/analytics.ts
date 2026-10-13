/** Lightweight onboarding analytics — isolated from product-operation events. */

export type OnboardingAnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'onboarding_dismissed'
  | 'onboarding_completed';

export interface OnboardingAnalyticsProps {
  tourId?: string;
  version?: number;
  stepId?: string;
  [key: string]: string | number | boolean | undefined;
}

type TrackFn = (event: OnboardingAnalyticsEvent, props?: OnboardingAnalyticsProps) => void;

let trackImpl: TrackFn = (event, props) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[onboarding]', event, props ?? {});
  }
};

/** Override for tests or a future analytics backend. */
export function setOnboardingAnalyticsTracker(fn: TrackFn): void {
  trackImpl = fn;
}

export function trackOnboarding(
  event: OnboardingAnalyticsEvent,
  props?: OnboardingAnalyticsProps,
): void {
  trackImpl(event, props);
}
