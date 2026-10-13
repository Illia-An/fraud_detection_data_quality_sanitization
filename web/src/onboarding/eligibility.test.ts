import { describe, expect, it } from 'vitest';

import {
  eligibleSteps,
  isStepEligible,
  nextEligibleStepId,
  prevEligibleStepId,
  progressForStep,
} from './eligibility';
import { TOUR_STEPS } from './tourConfig';

const emptyProduct = {
  hasProcessResult: false,
  hasPlannerPanel: false,
  hasDraftPlan: false,
};
const withResults = {
  hasProcessResult: true,
  hasPlannerPanel: true,
  hasDraftPlan: false,
};
const withDraft = {
  hasProcessResult: true,
  hasPlannerPanel: true,
  hasDraftPlan: true,
};

describe('onboarding eligibility', () => {
  it('skips sanitization-results when no processResult', () => {
    const eligible = eligibleSteps(TOUR_STEPS, emptyProduct);
    expect(eligible.map((s) => s.id)).not.toContain('sanitization-results');
    expect(eligible.map((s) => s.id)).toContain('sanitization-intro');
  });

  it('includes sanitization-results when processResult exists', () => {
    expect(
      isStepEligible(
        TOUR_STEPS.find((s) => s.id === 'sanitization-results')!,
        withResults,
      ),
    ).toBe(true);
  });

  it('walks next/prev across eligible steps', () => {
    const first = nextEligibleStepId(TOUR_STEPS, null, emptyProduct);
    expect(first).toBe('welcome');
    const second = nextEligibleStepId(TOUR_STEPS, 'welcome', emptyProduct);
    expect(second).toBe('workspace');
    expect(prevEligibleStepId(TOUR_STEPS, 'workspace', emptyProduct)).toBe('welcome');
    expect(prevEligibleStepId(TOUR_STEPS, 'welcome', emptyProduct)).toBeNull();
  });

  it('reports progress against eligible total', () => {
    const withoutResults = progressForStep(TOUR_STEPS, 'workspace', emptyProduct);
    const withRes = progressForStep(TOUR_STEPS, 'workspace', withResults);
    // processResult unlocks sanitization-results + sanitization-inspect
    expect(withoutResults.total).toBe(withRes.total - 2);
    expect(withoutResults.current).toBe(2);
  });

  it('includes at-risk and planner-inspect only when draft exists', () => {
    const withoutDraft = eligibleSteps(TOUR_STEPS, withResults).map((s) => s.id);
    const withDraftIds = eligibleSteps(TOUR_STEPS, withDraft).map((s) => s.id);
    expect(withoutDraft).not.toContain('planner-at-risk');
    expect(withoutDraft).not.toContain('planner-inspect');
    expect(withDraftIds).toContain('planner-at-risk');
    expect(withDraftIds).toContain('planner-inspect');
    expect(withDraftIds).toContain('sanitization-inspect');
  });

  it('always includes controls and levers steps', () => {
    const ids = eligibleSteps(TOUR_STEPS, emptyProduct).map((s) => s.id);
    expect(ids).toContain('sanitization-controls');
    expect(ids).toContain('planner-levers');
  });
});
