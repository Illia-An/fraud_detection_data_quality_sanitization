/** TTS planner draft vs approved snapshot. Separate session from the 5% planner. */

import { create } from 'zustand';
import { z } from 'zod';

import { ttsKpiPanelSchema, type TtsKpiPanel } from '../schemas/ttsKpiPanel';
import { ttsPlanSchema, type TtsPlan } from '../schemas/ttsPlan';
import { readSessionJson, removeSessionKey, writeSessionJson } from './sessionPersist';

export const TTS_PLANNER_SESSION_STORAGE_KEY = 'fraud-guard-tts-planner-session';

interface TtsPlannerScenarioState {
  approvedPlan: TtsPlan | null;
  draftPlan: TtsPlan | null;
  isDirty: boolean;
  selectedStoreId: number | null;
  /** Loaded KPI rows. Survives route changes; clearAll leaves this in place. */
  panel: TtsKpiPanel | null;
  setDraftFromRun: (plan: TtsPlan) => void;
  patchDraftPlan: (plan: TtsPlan) => void;
  acceptDraftAsApproved: () => void;
  discardDraft: () => void;
  clearAll: () => void;
  selectStore: (storeId: number | null) => void;
  setPanel: (panel: TtsKpiPanel | null) => void;
}

function plansEqual(a: TtsPlan | null, b: TtsPlan | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

const sessionSchema = z.object({
  approvedPlan: ttsPlanSchema.nullable(),
  draftPlan: ttsPlanSchema.nullable(),
  isDirty: z.boolean(),
  selectedStoreId: z.number().nullable(),
  panel: ttsKpiPanelSchema.nullable().optional(),
});

type SessionSlice = Omit<z.infer<typeof sessionSchema>, 'panel'> & {
  panel: TtsKpiPanel | null;
};

function emptySession(): SessionSlice {
  return {
    approvedPlan: null,
    draftPlan: null,
    isDirty: false,
    selectedStoreId: null,
    panel: null,
  };
}

function loadSession(): SessionSlice {
  const raw = readSessionJson<unknown>(TTS_PLANNER_SESSION_STORAGE_KEY);
  if (raw == null) {
    return emptySession();
  }
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) {
    removeSessionKey(TTS_PLANNER_SESSION_STORAGE_KEY);
    return emptySession();
  }
  return { ...parsed.data, panel: parsed.data.panel ?? null };
}

const hydrated = loadSession();

export const useTtsPlannerScenarioStore = create<TtsPlannerScenarioState>((set, get) => ({
  ...hydrated,

  setDraftFromRun: (plan) => {
    const baseline = get().approvedPlan ?? plan;
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
    set({ approvedPlan: draftPlan, isDirty: false });
  },

  discardDraft: () => {
    const { approvedPlan } = get();
    if (approvedPlan) {
      set({ draftPlan: approvedPlan, isDirty: false, selectedStoreId: null });
      return;
    }
    set({ draftPlan: null, isDirty: false, selectedStoreId: null });
  },

  clearAll: () =>
    set({
      approvedPlan: null,
      draftPlan: null,
      isDirty: false,
      selectedStoreId: null,
    }),

  selectStore: (storeId) => set({ selectedStoreId: storeId }),

  setPanel: (panel) => set({ panel }),
}));

useTtsPlannerScenarioStore.subscribe((state) => {
  writeSessionJson(TTS_PLANNER_SESSION_STORAGE_KEY, {
    approvedPlan: state.approvedPlan,
    draftPlan: state.draftPlan,
    isDirty: state.isDirty,
    selectedStoreId: state.selectedStoreId,
    panel: state.panel,
  });
});
