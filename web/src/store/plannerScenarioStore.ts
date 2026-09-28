/** V4.2 Step 1 — approved vs draft scenario isolation (session only, no DB). */

import { create } from 'zustand';

import type { FivePercentPlan } from '../schemas/plan';

interface PlannerScenarioState {
  approvedPlan: FivePercentPlan | null;
  draftPlan: FivePercentPlan | null;
  /** True when a draft exists and is not yet accepted as the session-approved snapshot. */
  isDirty: boolean;
  selectedStoreId: number | null;

  setDraftFromRun: (plan: FivePercentPlan) => void;
  acceptDraftAsApproved: () => void;
  discardDraft: () => void;
  clearAll: () => void;
  selectStore: (storeId: number | null) => void;
}

function plansEqual(a: FivePercentPlan | null, b: FivePercentPlan | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export const usePlannerScenarioStore = create<PlannerScenarioState>((set, get) => ({
  approvedPlan: null,
  draftPlan: null,
  isDirty: false,
  selectedStoreId: null,

  setDraftFromRun: (plan) => {
    const { approvedPlan } = get();
    set({
      draftPlan: plan,
      isDirty: approvedPlan == null || !plansEqual(approvedPlan, plan),
      selectedStoreId: null,
    });
  },

  acceptDraftAsApproved: () => {
    const { draftPlan } = get();
    if (!draftPlan) {
      return;
    }
    set({
      approvedPlan: draftPlan,
      isDirty: false,
    });
  },

  discardDraft: () => {
    const { approvedPlan } = get();
    if (approvedPlan) {
      set({
        draftPlan: approvedPlan,
        isDirty: false,
        selectedStoreId: null,
      });
      return;
    }
    set({
      draftPlan: null,
      isDirty: false,
      selectedStoreId: null,
    });
  },

  clearAll: () =>
    set({
      approvedPlan: null,
      draftPlan: null,
      isDirty: false,
      selectedStoreId: null,
    }),

  selectStore: (storeId) => set({ selectedStoreId: storeId }),
}));
