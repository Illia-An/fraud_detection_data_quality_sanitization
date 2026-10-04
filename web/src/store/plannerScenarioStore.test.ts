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

  it('first run locks baseline; later edits mark dirty until accept', () => {
    const plan = samplePlan(74);
    usePlannerScenarioStore.getState().setDraftFromRun(plan);
    expect(usePlannerScenarioStore.getState().isDirty).toBe(false);
    expect(usePlannerScenarioStore.getState().draftPlan?.final_chain).toBe(74);
    expect(usePlannerScenarioStore.getState().approvedPlan?.final_chain).toBe(74);

    usePlannerScenarioStore.getState().patchDraftPlan(samplePlan(72));
    expect(usePlannerScenarioStore.getState().isDirty).toBe(true);

    usePlannerScenarioStore.getState().acceptDraftAsApproved();
    expect(usePlannerScenarioStore.getState().isDirty).toBe(false);
    expect(usePlannerScenarioStore.getState().approvedPlan?.final_chain).toBe(72);
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
    const parsed = JSON.parse(raw!) as {
      draftPlan: FivePercentPlan | null;
      isDirty: boolean;
      approvedPlan: FivePercentPlan | null;
    };
    expect(parsed.draftPlan?.final_chain).toBe(71);
    expect(parsed.approvedPlan?.final_chain).toBe(71);
    expect(parsed.isDirty).toBe(false);
  });

  it('discardDraft restores baseline and clears Inspect selection', () => {
    usePlannerScenarioStore.getState().setDraftFromRun(samplePlan(74));
    usePlannerScenarioStore.getState().selectStore(10);
    usePlannerScenarioStore.getState().patchDraftPlan(samplePlan(70));
    expect(usePlannerScenarioStore.getState().isDirty).toBe(true);

    usePlannerScenarioStore.getState().discardDraft();
    expect(usePlannerScenarioStore.getState().draftPlan?.final_chain).toBe(74);
    expect(usePlannerScenarioStore.getState().isDirty).toBe(false);
    expect(usePlannerScenarioStore.getState().selectedStoreId).toBeNull();
  });

  it('patchDraftPlan updates draft but keeps Inspect selection', () => {
    usePlannerScenarioStore.getState().setDraftFromRun(samplePlan(74));
    usePlannerScenarioStore.getState().selectStore(10);
    usePlannerScenarioStore.getState().patchDraftPlan(samplePlan(72));
    expect(usePlannerScenarioStore.getState().draftPlan?.final_chain).toBe(72);
    expect(usePlannerScenarioStore.getState().selectedStoreId).toBe(10);
    expect(usePlannerScenarioStore.getState().isDirty).toBe(true);
  });
});
