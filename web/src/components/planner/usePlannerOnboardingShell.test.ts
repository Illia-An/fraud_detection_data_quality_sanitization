import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetOnboardingStoreForTests, useOnboardingStore } from '../../onboarding';
import {
  usePlannerOnboardingShell,
  type PlannerOnboardingPrefix,
} from './usePlannerOnboardingShell';

const SCROLL_DELAY_MS = 80;

function setStep(status: 'idle' | 'active', stepId: string | null): void {
  act(() => {
    useOnboardingStore.setState({
      status,
      stepId: stepId as never,
    });
  });
}

function addTarget(name: string): { scrollIntoView: ReturnType<typeof vi.fn> } {
  const el = document.createElement('div');
  el.setAttribute('data-onboarding', name);
  const scrollIntoView = vi.fn();
  el.scrollIntoView = scrollIntoView as unknown as typeof el.scrollIntoView;
  document.body.appendChild(el);
  return { scrollIntoView };
}

function mount(prefix: PlannerOnboardingPrefix) {
  const setControlsOpen = vi.fn();
  const setAtRiskExpanded = vi.fn();
  const view = renderHook(() =>
    usePlannerOnboardingShell({ prefix, setControlsOpen, setAtRiskExpanded }),
  );
  return { ...view, setControlsOpen, setAtRiskExpanded };
}

describe.each(['planner', 'tts-planner'] as const)('usePlannerOnboardingShell (%s)', (prefix) => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetOnboardingStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    resetOnboardingStoreForTests();
  });

  it('does nothing while the tour is not active', () => {
    const { setControlsOpen, setAtRiskExpanded } = mount(prefix);
    setStep('idle', `${prefix}-levers`);
    act(() => {
      vi.advanceTimersByTime(SCROLL_DELAY_MS * 2);
    });
    expect(setControlsOpen).not.toHaveBeenCalled();
    expect(setAtRiskExpanded).not.toHaveBeenCalled();
  });

  it('opens the rail and collapses At-risk on the levers step', () => {
    const { setControlsOpen, setAtRiskExpanded } = mount(prefix);
    setStep('active', `${prefix}-levers`);
    expect(setControlsOpen).toHaveBeenCalledWith(true);
    expect(setAtRiskExpanded).toHaveBeenCalledWith(false);
  });

  it('collapses At-risk and scrolls Hero to center after the delay on the hero step', () => {
    const hero = addTarget(`${prefix}-hero`);
    const { setAtRiskExpanded, setControlsOpen } = mount(prefix);
    setStep('active', `${prefix}-hero`);

    expect(setAtRiskExpanded).toHaveBeenCalledWith(false);
    expect(setControlsOpen).not.toHaveBeenCalled();
    expect(hero.scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SCROLL_DELAY_MS);
    });
    expect(hero.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('expands At-risk and scrolls it to the start of the viewport screen', () => {
    const atRisk = addTarget(`${prefix}-at-risk`);
    const inspect = addTarget(`${prefix}-inspect`);
    const { setAtRiskExpanded } = mount(prefix);
    setStep('active', `${prefix}-at-risk`);

    expect(setAtRiskExpanded).toHaveBeenCalledWith(true);
    act(() => {
      vi.advanceTimersByTime(SCROLL_DELAY_MS);
    });
    expect(atRisk.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(inspect.scrollIntoView).not.toHaveBeenCalled();
  });

  it('also scrolls the inspect target on the inspect step', () => {
    const atRisk = addTarget(`${prefix}-at-risk`);
    const inspect = addTarget(`${prefix}-inspect`);
    const { setAtRiskExpanded } = mount(prefix);
    setStep('active', `${prefix}-inspect`);

    expect(setAtRiskExpanded).toHaveBeenCalledWith(true);
    act(() => {
      vi.advanceTimersByTime(SCROLL_DELAY_MS);
    });
    expect(atRisk.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(inspect.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('cancels the pending scroll when the step changes first', () => {
    const hero = addTarget(`${prefix}-hero`);
    const { setControlsOpen } = mount(prefix);
    setStep('active', `${prefix}-hero`);
    setStep('active', `${prefix}-levers`);
    act(() => {
      vi.advanceTimersByTime(SCROLL_DELAY_MS * 2);
    });
    expect(hero.scrollIntoView).not.toHaveBeenCalled();
    expect(setControlsOpen).toHaveBeenCalledWith(true);
  });

  it('ignores steps that belong to the other planner', () => {
    const other = prefix === 'planner' ? 'tts-planner' : 'planner';
    const { setControlsOpen, setAtRiskExpanded } = mount(prefix);
    setStep('active', `${other}-levers`);
    expect(setControlsOpen).not.toHaveBeenCalled();
    expect(setAtRiskExpanded).not.toHaveBeenCalled();
  });
});
