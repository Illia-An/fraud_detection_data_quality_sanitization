import { create } from 'zustand';

import type {
  DataSource,
  ProcessResponse,
  SamplePresetMeta,
  SurveyAnswerRow,
} from '../schemas/api';

interface UiState {
  selectedStoreId: number | null;
  lastPreset: DataSource;
  surveyRows: SurveyAnswerRow[];
  sampleMeta: SamplePresetMeta | null;
  sampleGeneration: number;
  processResult: ProcessResponse | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: DataSource) => void;
  setSurveyData: (rows: SurveyAnswerRow[], meta: SamplePresetMeta, preset: DataSource) => void;
  setProcessResult: (result: ProcessResponse | null) => void;
  clearSurveyData: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: null,
  lastPreset: 'db',
  surveyRows: [],
  sampleMeta: null,
  sampleGeneration: 0,
  processResult: null,
  setSelectedStoreId: (storeId) => set({ selectedStoreId: storeId }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
  setSurveyData: (rows, meta, preset) =>
    set((state) => ({
      surveyRows: rows,
      sampleMeta: meta,
      lastPreset: preset,
      processResult: null,
      sampleGeneration: state.sampleGeneration + 1,
    })),
  setProcessResult: (result) => set({ processResult: result }),
  clearSurveyData: () =>
    set({ surveyRows: [], sampleMeta: null, processResult: null, sampleGeneration: 0 }),
}));
