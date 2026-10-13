import { afterEach, describe, expect, it } from 'vitest';

import {
  isEffectivelyVisible,
  queryOnboardingTargetForTour,
  queryScrollableOnboardingTarget,
  queryVisibleOnboardingTarget,
} from './resolveTarget';

describe('resolveTarget visibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('skips aria-hidden and off-viewport duplicates, prefers desktop surface', () => {
    const hidden = document.createElement('div');
    hidden.setAttribute('data-onboarding', 'nav-main');
    hidden.setAttribute('data-onboarding-surface', 'mobile');
    hidden.setAttribute('aria-hidden', 'true');
    hidden.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:400px';
    document.body.appendChild(hidden);

    const desktop = document.createElement('div');
    desktop.setAttribute('data-onboarding', 'nav-main');
    desktop.setAttribute('data-onboarding-surface', 'desktop');
    desktop.style.cssText = 'position:fixed;top:0;right:0;width:180px;height:500px';
    document.body.appendChild(desktop);

    // jsdom getBoundingClientRect is 0 by default — stub.
    hidden.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        width: 200,
        height: 400,
        bottom: 400,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    desktop.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 600,
        width: 180,
        height: 500,
        bottom: 500,
        right: 780,
        x: 600,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    expect(isEffectivelyVisible(hidden)).toBe(false);
    expect(isEffectivelyVisible(desktop)).toBe(true);
    expect(queryVisibleOnboardingTarget('nav-main')).toBe(desktop);
  });

  it('returns null when nothing is effectively visible', () => {
    const off = document.createElement('div');
    off.setAttribute('data-onboarding', 'nav-planner');
    document.body.appendChild(off);
    off.getBoundingClientRect = () =>
      ({
        top: 0,
        left: -400,
        width: 200,
        height: 40,
        bottom: 40,
        right: -200,
        x: -400,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    expect(queryVisibleOnboardingTarget('nav-planner')).toBeNull();
    // Off-screen but renderable — still scrollable for tour handoff.
    expect(queryScrollableOnboardingTarget('nav-planner')).toBe(off);
    expect(queryOnboardingTargetForTour('nav-planner')).toBe(off);
  });
});
