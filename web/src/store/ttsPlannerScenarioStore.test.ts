import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TtsKpiPanel } from '../schemas/ttsKpiPanel';
import type { TtsPlan } from '../schemas/ttsPlan';
import {
  TTS_PLANNER_SESSION_STORAGE_KEY,
  useTtsPlannerScenarioStore,
} from './ttsPlannerScenarioStore';

const samplePlan = (): TtsPlan => ({
  metric_id: 'tts',
  unit: 'min',
  direction: 'lower_is_better',
  target: 3.5,
  current_chain: 4,
  required_change: 0.5,
  final_chain: 3.5,
  feasible: true,
  chain_trajectory: [{ year: 2026, month: 1, score: 3.5 }],
  projections: [{ store_id: 10, months: [{ year: 2026, month: 1, score: 3.5 }] }],
});

const samplePanel = (): TtsKpiPanel => ({
  preset: 'small',
  period_start: '2025-12-01',
  period_end: '2025-12-01',
  reference_year: 2025,
  reference_month: 12,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 12, tts: 4.2 }],
});

describe('useTtsPlannerScenarioStore', () => {
  beforeEach(() => {
    sessionStorage.removeItem(TTS_PLANNER_SESSION_STORAGE_KEY);
    useTtsPlannerScenarioStore.getState().clearAll();
    useTtsPlannerScenarioStore.getState().setPanel(null);
  });

  it('keeps the loaded panel when the draft plan is cleared', () => {
    useTtsPlannerScenarioStore.getState().setPanel(samplePanel());
    useTtsPlannerScenarioStore.getState().setDraftFromRun(samplePlan());

    useTtsPlannerScenarioStore.getState().clearAll();

    expect(useTtsPlannerScenarioStore.getState().draftPlan).toBeNull();
    expect(useTtsPlannerScenarioStore.getState().panel?.row_count).toBe(1);
    const raw = sessionStorage.getItem(TTS_PLANNER_SESSION_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '{}') as { panel: TtsKpiPanel | null };
    expect(parsed.panel?.reference_month).toBe(12);
  });

  it('keeps a saved draft when an older session has no panel', async () => {
    sessionStorage.setItem(
      TTS_PLANNER_SESSION_STORAGE_KEY,
      JSON.stringify({
        approvedPlan: samplePlan(),
        draftPlan: samplePlan(),
        isDirty: false,
        selectedStoreId: null,
      }),
    );
    vi.resetModules();
    const reloaded = await import('./ttsPlannerScenarioStore');
    expect(reloaded.useTtsPlannerScenarioStore.getState().draftPlan?.final_chain).toBe(3.5);
    expect(reloaded.useTtsPlannerScenarioStore.getState().panel).toBeNull();
  });
});
