import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { directionForLocale, useLocaleStore, useT } from '../i18n';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';
import { progressForStep, type OnboardingProductState } from './eligibility';
import { useOnboardingStore } from './onboardingStore';
import {
  queryOnboardingTargetForTour,
  queryVisibleOnboardingTarget,
  readTargetRect,
  type TargetRect,
} from './resolveTarget';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TourCard } from './TourCard';
import {
  getStepById,
  resolveTourPlacement,
  TOUR_STEPS,
  type OnboardingStepId,
  type TourStepConfig,
} from './tourConfig';

const TARGET_RETRY_MS = 80;
const TARGET_RETRY_MAX = 20;
/** Remeasure after scroll/expand so spotlight matches the final layout. */
const TARGET_SETTLE_PASSES = 4;
const TARGET_SETTLE_MS = 50;
/** Let Emotion/MUI RTL remount settle before the first measure. */
const LAYOUT_DEFER_MS = 50;

interface DisplayFrame {
  step: TourStepConfig;
  target: TargetRect | null;
  progress: { current: number; total: number };
}

function useProductState(): OnboardingProductState {
  const processResult = useUiStore((s) => s.processResult);
  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);
  return useMemo(
    () => ({
      hasProcessResult: processResult != null,
      hasPlannerPanel: processResult != null || draftPlan != null,
      hasDraftPlan: draftPlan != null,
    }),
    [processResult, draftPlan],
  );
}

function routeMatchesStep(pathname: string, step: TourStepConfig): boolean {
  return step.route == null || pathname === step.route;
}

export function OnboardingHost() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const direction = directionForLocale(locale);
  const navigate = useNavigate();
  const location = useLocation();
  const product = useProductState();

  const status = useOnboardingStore((s) => s.status);
  const stepId = useOnboardingStore((s) => s.stepId);
  const bootstrapped = useOnboardingStore((s) => s.bootstrapped);
  const bootstrap = useOnboardingStore((s) => s.bootstrap);
  const next = useOnboardingStore((s) => s.next);
  const back = useOnboardingStore((s) => s.back);
  const dismiss = useOnboardingStore((s) => s.dismiss);
  const complete = useOnboardingStore((s) => s.complete);

  /** Last fully-resolved frame — kept on screen during route/anchor transitions. */
  const [display, setDisplay] = useState<DisplayFrame | null>(null);

  useEffect(() => {
    bootstrap(product);
  }, [bootstrap, product]);

  const step = stepId != null ? getStepById(stepId) : undefined;
  const active = status === 'active' && step != null && bootstrapped;
  const transitioning = display != null && step != null && display.step.id !== step.id;

  // Navigate to the step's route when needed (before probing anchors).
  useEffect(() => {
    if (!active || !step?.route) {
      return;
    }
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [active, step, location.pathname, navigate]);

  // Resolve spotlight target once the step route is mounted.
  useEffect(() => {
    if (!active || !step) {
      setDisplay(null);
      return;
    }

    // Cross-route: keep previous frame until Planner/Sanitization mounts.
    if (!routeMatchesStep(location.pathname, step)) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const settleTimers: number[] = [];

    const progress = progressForStep(TOUR_STEPS, step.id, product);

    const commitFrame = (target: TargetRect | null) => {
      if (cancelled) {
        return;
      }
      setDisplay({ step, target, progress });
    };

    const remeasure = () => {
      const el =
        queryVisibleOnboardingTarget(step.anchor!) ??
        queryOnboardingTargetForTour(step.anchor!);
      if (el) {
        commitFrame(readTargetRect(el));
      }
    };

    const settleAfterScroll = (el: HTMLElement) => {
      if (typeof el.scrollIntoView === 'function') {
        // Instant jump — smooth scroll made cross-route steps feel laggy.
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }
      let passes = 0;
      const tick = () => {
        if (cancelled) {
          return;
        }
        remeasure();
        passes += 1;
        if (passes >= TARGET_SETTLE_PASSES) {
          return;
        }
        settleTimers.push(window.setTimeout(tick, TARGET_SETTLE_MS));
      };
      commitFrame(readTargetRect(el));
      settleTimers.push(window.setTimeout(tick, TARGET_SETTLE_MS));
    };

    const tryResolve = () => {
      if (cancelled) {
        return;
      }
      if (!step.anchor) {
        commitFrame(null);
        return;
      }
      const el = queryOnboardingTargetForTour(step.anchor);
      if (el) {
        settleAfterScroll(el);
        return;
      }
      attempts += 1;
      if (attempts >= TARGET_RETRY_MAX) {
        // Missing target — still show the card (no crash).
        commitFrame(null);
        return;
      }
      settleTimers.push(window.setTimeout(tryResolve, TARGET_RETRY_MS));
    };

    settleTimers.push(window.setTimeout(tryResolve, LAYOUT_DEFER_MS));

    const onResize = () => {
      if (step.anchor) {
        remeasure();
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      for (const id of settleTimers) {
        window.clearTimeout(id);
      }
      window.removeEventListener('resize', onResize);
    };
  }, [active, step, location.pathname, locale, direction, product]);

  const handlePrimary = useCallback(() => {
    if (transitioning) {
      return;
    }
    if (stepId === 'complete') {
      complete();
      if (location.pathname !== '/') {
        navigate('/');
      }
      return;
    }
    next(product);
  }, [transitioning, stepId, complete, next, product, location.pathname, navigate]);

  const handleBack = useCallback(() => {
    if (transitioning) {
      return;
    }
    back(product);
  }, [transitioning, back, product]);

  const handleExit = useCallback(() => dismiss(), [dismiss]);

  const frame = display;
  if (!active || !frame) {
    return null;
  }

  const placement = resolveTourPlacement(frame.step.placement, direction);
  const dimOnly =
    placement === 'center' || frame.step.anchor == null || frame.target == null;

  const primaryLabel = (() => {
    if (frame.step.id === 'welcome') {
      return t('onboarding.start');
    }
    if (frame.step.id === 'complete') {
      return t('onboarding.finish');
    }
    return t('onboarding.next');
  })();

  return (
    <>
      <SpotlightOverlay
        target={frame.target}
        dimOnly={dimOnly}
        onBackdropClick={handleExit}
      />
      <TourCard
        stepId={frame.step.id as OnboardingStepId}
        title={t(frame.step.titleKey)}
        body={t(frame.step.bodyKey)}
        progressLabel={t('onboarding.progress', {
          current: frame.progress.current,
          total: frame.progress.total,
        })}
        placement={placement}
        target={frame.target}
        canGoBack={frame.progress.current > 1}
        primaryLabel={primaryLabel}
        onPrimary={handlePrimary}
        onBack={handleBack}
        onExit={handleExit}
      />
    </>
  );
}
