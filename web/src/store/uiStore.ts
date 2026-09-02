import { create } from 'zustand';

import type { SamplePreset, SamplePresetMeta, SurveyAnswerRow } from '../schemas/api';

interface UiState {
  selectedStoreId: number | null;
  lastPreset: SamplePreset;
  surveyRows: SurveyAnswerRow[];
  sampleMeta: SamplePresetMeta | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: SamplePreset) => void;
  setSurveyData: (rows: SurveyAnswerRow[], meta: SamplePresetMeta, preset: SamplePreset) => void;
  clearSurveyData: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: null,
  lastPreset: 'small',
  surveyRows: [],
  sampleMeta: null,
  setSelectedStoreId: (storeId) => set({ selectedStoreId: storeId }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
  setSurveyData: (rows, meta, preset) =>
    set({
      surveyRows: rows,
      sampleMeta: meta,
      lastPreset: preset,
    }),
  clearSurveyData: () => set({ surveyRows: [], sampleMeta: null }),
}));
