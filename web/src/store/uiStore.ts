import { create } from 'zustand';

import type {
  DataSource,
  ProcessResponse,
  SamplePresetMeta,
  SurveyAnswerRow,
} from '../schemas/api';

interface UiState {
  selectedStoreId: number | null;
  /** Period label ``YYYY-MM`` highlighted from FlaggedMonthsTable → chart. */
  highlightedPeriodLabel: string | null;
  lastPreset: DataSource;
  surveyRows: SurveyAnswerRow[];
  sampleMeta: SamplePresetMeta | null;
  sampleGeneration: number;
  processResult: ProcessResponse | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setHighlightedPeriodLabel: (periodLabel: string | null) => void;
  /** Table → chart: select store and highlight month in one step. */
  selectFlaggedStoreMonth: (storeId: number, year: number, month: number) => void;
  setLastPreset: (preset: DataSource) => void;
  setSurveyData: (rows: SurveyAnswerRow[], meta: SamplePresetMeta, preset: DataSource) => void;
  setProcessResult: (result: ProcessResponse | null) => void;
  clearSurveyData: () => void;
}

function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: null,
  highlightedPeriodLabel: null,
  lastPreset: 'db',
  surveyRows: [],
  sampleMeta: null,
  sampleGeneration: 0,
  processResult: null,
  setSelectedStoreId: (storeId) =>
    set({ selectedStoreId: storeId, highlightedPeriodLabel: null }),
  setHighlightedPeriodLabel: (periodLabelValue) =>
    set({ highlightedPeriodLabel: periodLabelValue }),
  selectFlaggedStoreMonth: (storeId, year, month) =>
    set({
      selectedStoreId: storeId,
      highlightedPeriodLabel: periodLabel(year, month),
    }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
  setSurveyData: (rows, meta, preset) =>
    set((state) => ({
      surveyRows: rows,
      sampleMeta: meta,
      lastPreset: preset,
      processResult: null,
      highlightedPeriodLabel: null,
      sampleGeneration: state.sampleGeneration + 1,
    })),
  setProcessResult: (result) => set({ processResult: result }),
  clearSurveyData: () =>
    set({
      surveyRows: [],
      sampleMeta: null,
      processResult: null,
      highlightedPeriodLabel: null,
      sampleGeneration: 0,
    }),
}));
