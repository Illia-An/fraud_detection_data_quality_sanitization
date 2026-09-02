import { create } from 'zustand';

import type { ProcessResponse, SamplePreset, SamplePresetMeta, SurveyAnswerRow } from '../schemas/api';

interface UiState {
  selectedStoreId: number | null;
  lastPreset: SamplePreset;
  surveyRows: SurveyAnswerRow[];
  sampleMeta: SamplePresetMeta | null;
  processResult: ProcessResponse | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: SamplePreset) => void;
  setSurveyData: (rows: SurveyAnswerRow[], meta: SamplePresetMeta, preset: SamplePreset) => void;
  setProcessResult: (result: ProcessResponse | null) => void;
  clearSurveyData: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: null,
  lastPreset: 'small',
  surveyRows: [],
  sampleMeta: null,
  processResult: null,
  setSelectedStoreId: (storeId) => set({ selectedStoreId: storeId }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
  setSurveyData: (rows, meta, preset) =>
    set({
      surveyRows: rows,
      sampleMeta: meta,
      lastPreset: preset,
      processResult: null,
    }),
  setProcessResult: (result) => set({ processResult: result }),
  clearSurveyData: () => set({ surveyRows: [], sampleMeta: null, processResult: null }),
}));
