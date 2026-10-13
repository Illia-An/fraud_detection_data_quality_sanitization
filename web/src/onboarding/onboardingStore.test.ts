import { beforeEach, describe, expect, it } from 'vitest';

import {
  ONBOARDING_STORAGE_KEY,
  resetOnboardingStoreForTests,
  useOnboardingStore,
} from './onboardingStore';

const product = {
  hasProcessResult: false,
  hasPlannerPanel: false,
  hasDraftPlan: false,
};
const productWithResults = {
  hasProcessResult: true,
  hasPlannerPanel: true,
  hasDraftPlan: false,
};

describe('onboardingStore', () => {
  beforeEach(() => {
    resetOnboardingStoreForTests();
  });

  it('starts on welcome and persists active status', () => {
    useOnboardingStore.getState().start(product);
    const state = useOnboardingStore.getState();
    expect(state.status).toBe('active');
    expect(state.stepId).toBe('welcome');
    const raw = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
    expect(raw.status).toBe('active');
    expect(raw.stepId).toBe('welcome');
  });

  it('navigates next and back', () => {
    const store = useOnboardingStore.getState();
    store.start(product);
    store.next(product);
    expect(useOnboardingStore.getState().stepId).toBe('workspace');
    store.back(product);
    expect(useOnboardingStore.getState().stepId).toBe('welcome');
  });

  it('skips sanitization-results when ineligible', () => {
    const store = useOnboardingStore.getState();
    store.start(product);
    // welcome → workspace → intro → controls → planner-entry (skip results/inspect)
    store.next(product);
    store.next(product);
    store.next(product);
    expect(useOnboardingStore.getState().stepId).toBe('sanitization-controls');
    store.next(product);
    expect(useOnboardingStore.getState().stepId).toBe('planner-entry');
  });

  it('includes sanitization-results then inspect when eligible', () => {
    const store = useOnboardingStore.getState();
    store.start(productWithResults);
    store.next(productWithResults); // workspace
    store.next(productWithResults); // intro
    store.next(productWithResults); // controls
    store.next(productWithResults); // results
    expect(useOnboardingStore.getState().stepId).toBe('sanitization-results');
    store.next(productWithResults);
    expect(useOnboardingStore.getState().stepId).toBe('sanitization-inspect');
  });

  it('dismisses and can restart', () => {
    const store = useOnboardingStore.getState();
    store.start(product);
    store.dismiss();
    expect(useOnboardingStore.getState().status).toBe('dismissed');
    expect(useOnboardingStore.getState().stepId).toBeNull();
    store.restart(product);
    expect(useOnboardingStore.getState().status).toBe('active');
    expect(useOnboardingStore.getState().stepId).toBe('welcome');
  });

  it('completes from the complete step', () => {
    useOnboardingStore.setState({
      status: 'active',
      stepId: 'complete',
      completedStepIds: [],
      bootstrapped: true,
    });
    useOnboardingStore.getState().next(product);
    expect(useOnboardingStore.getState().status).toBe('completed');
    expect(useOnboardingStore.getState().stepId).toBeNull();
  });

  it('bootstrap auto-starts when idle', () => {
    useOnboardingStore.getState().bootstrap(product);
    expect(useOnboardingStore.getState().status).toBe('active');
    expect(useOnboardingStore.getState().bootstrapped).toBe(true);
    // second bootstrap is a no-op
    useOnboardingStore.getState().bootstrap(product);
    expect(useOnboardingStore.getState().stepId).toBe('welcome');
  });
});
