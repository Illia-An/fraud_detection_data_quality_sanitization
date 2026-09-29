import { beforeEach, describe, expect, it } from 'vitest';

import type { FivePercentPlan } from '../schemas/plan';
import {
  PLANNER_SESSION_STORAGE_KEY,
  usePlannerScenarioStore,
} from './plannerScenarioStore';

const samplePlan = (final: number): FivePercentPlan => ({
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: final,
  feasible: true,
  chain_trajectory: [{ year: 2025, month: 4, score: final }],
  projections: [{ store_id: 10, months: [{ year: 2025, month: 4, score: final }] }],
});

describe('usePlannerScenarioStore', () => {
  beforeEach(() => {
    sessionStorage.removeItem(PLANNER_SESSION_STORAGE_KEY);
    usePlannerScenarioStore.getState().clearAll();
  });

  it('marks dirty after run until accept', () => {
    const plan = samplePlan(74);
    usePlannerScenarioStore.getState().setDraftFromRun(plan);
    expect(usePlannerScenarioStore.getState().isDirty).toBe(true);
    expect(usePlannerScenarioStore.getState().draftPlan?.final_chain).toBe(74);

    usePlannerScenarioStore.getState().acceptDraftAsApproved();
    expect(usePlannerScenarioStore.getState().isDirty).toBe(false);
    expect(usePlannerScenarioStore.getState().approvedPlan?.final_chain).toBe(74);
  });

  it('discard restores approved snapshot', () => {
    usePlannerScenarioStore.getState().setDraftFromRun(samplePlan(74));
    usePlannerScenarioStore.getState().acceptDraftAsApproved();
    usePlannerScenarioStore.getState().setDraftFromRun(samplePlan(72));
    expect(usePlannerScenarioStore.getState().isDirty).toBe(true);

    usePlannerScenarioStore.getState().discardDraft();
    expect(usePlannerScenarioStore.getState().isDirty).toBe(false);
    expect(usePlannerScenarioStore.getState().draftPlan?.final_chain).toBe(74);
  });

  it('persists draft plan to sessionStorage', () => {
    usePlannerScenarioStore.getState().setDraftFromRun(samplePlan(71));
    const raw = sessionStorage.getItem(PLANNER_SESSION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { draftPlan: FivePercentPlan | null; isDirty: boolean };
    expect(parsed.draftPlan?.final_chain).toBe(71);
    expect(parsed.isDirty).toBe(true);
  });
});
