/** V4.2 Step 1 — approved vs draft scenario isolation (session only, no DB). */

import { create } from 'zustand';
import { z } from 'zod';

import { fivePercentPlanSchema, type FivePercentPlan } from '../schemas/plan';
import { readSessionJson, removeSessionKey, writeSessionJson } from './sessionPersist';

export const PLANNER_SESSION_STORAGE_KEY = 'fraud-guard-planner-session';

interface PlannerScenarioState {
  approvedPlan: FivePercentPlan | null;
  draftPlan: FivePercentPlan | null;
  /** True when a draft exists and is not yet accepted as the session-approved snapshot. */
  isDirty: boolean;
  selectedStoreId: number | null;

  setDraftFromRun: (plan: FivePercentPlan) => void;
  /**
   * Patch session draft without clearing Inspect selection
   * (sandbox Apply / undo).
   */
  patchDraftPlan: (plan: FivePercentPlan) => void;
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

const plannerSessionSchema = z.object({
  approvedPlan: fivePercentPlanSchema.nullable(),
  draftPlan: fivePercentPlanSchema.nullable(),
  isDirty: z.boolean(),
  selectedStoreId: z.number().nullable(),
});

type PlannerSessionSlice = z.infer<typeof plannerSessionSchema>;

function defaultPlannerSession(): PlannerSessionSlice {
  return {
    approvedPlan: null,
    draftPlan: null,
    isDirty: false,
    selectedStoreId: null,
  };
}

function loadPlannerSession(): PlannerSessionSlice {
  const raw = readSessionJson<unknown>(PLANNER_SESSION_STORAGE_KEY);
  if (raw == null) {
    return defaultPlannerSession();
  }
  const parsed = plannerSessionSchema.safeParse(raw);
  if (!parsed.success) {
    removeSessionKey(PLANNER_SESSION_STORAGE_KEY);
    return defaultPlannerSession();
  }
  return parsed.data;
}

function persistPlannerSession(state: PlannerScenarioState): void {
  const slice: PlannerSessionSlice = {
    approvedPlan: state.approvedPlan,
    draftPlan: state.draftPlan,
    isDirty: state.isDirty,
    selectedStoreId: state.selectedStoreId,
  };
  writeSessionJson(PLANNER_SESSION_STORAGE_KEY, slice);
}

const hydrated = loadPlannerSession();

export const usePlannerScenarioStore = create<PlannerScenarioState>((set, get) => ({
  ...hydrated,

  setDraftFromRun: (plan) => {
    const { approvedPlan } = get();
    // First run locks session baseline so Revert draft has a restore target.
    const baseline = approvedPlan ?? plan;
    set({
      draftPlan: plan,
      approvedPlan: baseline,
      isDirty: !plansEqual(baseline, plan),
      selectedStoreId: null,
    });
  },

  patchDraftPlan: (plan) => {
    const { approvedPlan, selectedStoreId } = get();
    set({
      draftPlan: plan,
      isDirty: approvedPlan == null || !plansEqual(approvedPlan, plan),
      selectedStoreId,
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

usePlannerScenarioStore.subscribe((state) => {
  persistPlannerSession(state);
});
