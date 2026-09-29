import { create } from 'zustand';

import {
  dataSourceSchema,
  processResponseSchema,
  samplePresetMetaSchema,
  surveyAnswerRowSchema,
  type DataSource,
  type ProcessResponse,
  type SamplePresetMeta,
  type SurveyAnswerRow,
} from '../schemas/api';
import type { ChartScopeMode, ChartTimeMode } from '../schemas/chartUi';
import {
  DEFAULT_PERIOD_PRESET,
  periodPresetSchema,
  type PeriodPreset,
} from '../schemas/period';
import { readSessionJson, removeSessionKey, writeSessionJson } from './sessionPersist';
import { z } from 'zod';

export const UI_SESSION_STORAGE_KEY = 'fraud-guard-ui-session';

interface UiState {
  selectedStoreId: number | null;
  /** Period label ``YYYY-MM`` highlighted from FlaggedMonthsTable → chart. */
  highlightedPeriodLabel: string | null;
  lastPreset: DataSource;
  /** AnswerTime window preset for source=db /process (Survey data panel). */
  periodPreset: PeriodPreset;
  customFromDate: string;
  customToDate: string;
  /** Store | Network — drives chart + KPI strip scope. */
  chartScope: ChartScopeMode;
  /** Timeline | YoY overlay for the impact chart. */
  chartTimeMode: ChartTimeMode;
  surveyRows: SurveyAnswerRow[];
  sampleMeta: SamplePresetMeta | null;
  sampleGeneration: number;
  /**
   * Fingerprint of the last applied sample load (preset + react-query dataUpdatedAt).
   * Remounts with the same cached query must not bump generation / clear processResult.
   */
  sampleDataKey: string | null;
  processResult: ProcessResponse | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setHighlightedPeriodLabel: (periodLabel: string | null) => void;
  /** Table → chart: select store and highlight month in one step. */
  selectFlaggedStoreMonth: (storeId: number, year: number, month: number) => void;
  setLastPreset: (preset: DataSource) => void;
  setPeriodPreset: (preset: PeriodPreset) => void;
  setCustomPeriod: (fromDate: string, toDate: string) => void;
  setChartScope: (scope: ChartScopeMode) => void;
  setChartTimeMode: (mode: ChartTimeMode) => void;
  /**
   * Apply sample payload. Pass ``loadToken`` (react-query ``dataUpdatedAt``) so identical
   * cached loads are no-ops. Returns true when state changed (bump + clear process).
   */
  setSurveyData: (
    rows: SurveyAnswerRow[],
    meta: SamplePresetMeta,
    preset: DataSource,
    loadToken?: number,
  ) => boolean;
  /**
   * Prepare for an explicit DB reload: drop load fingerprint so the next sample
   * apply clears processResult and re-triggers the pipeline.
   */
  beginSampleReload: () => void;
  setProcessResult: (result: ProcessResponse | null) => void;
  clearSurveyData: () => void;
}

function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function buildSampleDataKey(
  preset: DataSource,
  meta: SamplePresetMeta,
  rows: SurveyAnswerRow[],
  loadToken: number,
): string {
  return `${preset}:${loadToken}:${meta.row_count}:${meta.store_count}:${meta.month_count}:${rows.length}`;
}

export function buildSampleContentKey(
  preset: DataSource,
  meta: SamplePresetMeta,
  rows: SurveyAnswerRow[],
): string {
  return `${preset}:${meta.row_count}:${meta.store_count}:${meta.month_count}:${rows.length}`;
}

const chartScopeSchema = z.enum(['store', 'network']);
const chartTimeModeSchema = z.enum(['timeline', 'yoy']);

const uiSessionSchema = z.object({
  selectedStoreId: z.number().nullable(),
  highlightedPeriodLabel: z.string().nullable(),
  lastPreset: dataSourceSchema,
  periodPreset: periodPresetSchema,
  customFromDate: z.string(),
  customToDate: z.string(),
  chartScope: chartScopeSchema,
  chartTimeMode: chartTimeModeSchema,
  surveyRows: z.array(surveyAnswerRowSchema),
  sampleMeta: samplePresetMetaSchema.nullable(),
  sampleGeneration: z.number().int().nonnegative(),
  sampleDataKey: z.string().nullable(),
  processResult: processResponseSchema.nullable(),
});

type UiSessionSlice = z.infer<typeof uiSessionSchema>;

function defaultSessionSlice(): UiSessionSlice {
  return {
    selectedStoreId: null,
    highlightedPeriodLabel: null,
    lastPreset: 'db',
    periodPreset: DEFAULT_PERIOD_PRESET,
    customFromDate: '2025-01-01',
    customToDate: '',
    chartScope: 'store',
    chartTimeMode: 'timeline',
    surveyRows: [],
    sampleMeta: null,
    sampleGeneration: 0,
    sampleDataKey: null,
    processResult: null,
  };
}

function loadUiSession(): UiSessionSlice {
  const raw = readSessionJson<unknown>(UI_SESSION_STORAGE_KEY);
  if (raw == null) {
    return defaultSessionSlice();
  }
  const parsed = uiSessionSchema.safeParse(raw);
  if (!parsed.success) {
    removeSessionKey(UI_SESSION_STORAGE_KEY);
    return defaultSessionSlice();
  }
  return parsed.data;
}

function persistUiSession(state: UiState): void {
  const slice: UiSessionSlice = {
    selectedStoreId: state.selectedStoreId,
    highlightedPeriodLabel: state.highlightedPeriodLabel,
    lastPreset: state.lastPreset,
    periodPreset: state.periodPreset,
    customFromDate: state.customFromDate,
    customToDate: state.customToDate,
    chartScope: state.chartScope,
    chartTimeMode: state.chartTimeMode,
    surveyRows: state.surveyRows,
    sampleMeta: state.sampleMeta,
    sampleGeneration: state.sampleGeneration,
    sampleDataKey: state.sampleDataKey,
    processResult: state.processResult,
  };
  writeSessionJson(UI_SESSION_STORAGE_KEY, slice);
}

const hydrated = loadUiSession();

export const useUiStore = create<UiState>((set, get) => ({
  ...hydrated,
  setSelectedStoreId: (storeId) =>
    set({ selectedStoreId: storeId, highlightedPeriodLabel: null }),
  setHighlightedPeriodLabel: (periodLabelValue) =>
    set({ highlightedPeriodLabel: periodLabelValue }),
  selectFlaggedStoreMonth: (storeId, year, month) =>
    set({
      selectedStoreId: storeId,
      highlightedPeriodLabel: periodLabel(year, month),
      chartScope: 'store',
    }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
  setPeriodPreset: (preset) => set({ periodPreset: preset }),
  setCustomPeriod: (fromDate, toDate) =>
    set({ customFromDate: fromDate, customToDate: toDate }),
  setChartScope: (scope) => set({ chartScope: scope }),
  setChartTimeMode: (mode) => set({ chartTimeMode: mode }),
  setSurveyData: (rows, meta, preset, loadToken) => {
    const state = get();
    const nextKey =
      loadToken != null ? buildSampleDataKey(preset, meta, rows, loadToken) : null;
    if (nextKey != null && state.sampleDataKey === nextKey) {
      return false;
    }

    const nextContent = buildSampleContentKey(preset, meta, rows);
    const prevContent =
      state.sampleMeta != null
        ? buildSampleContentKey(state.lastPreset, state.sampleMeta, state.surveyRows)
        : null;

    // F5 / fresh query timestamp with same sample content: keep processResult.
    // Explicit Reload calls beginSampleReload() first (sampleDataKey → null).
    if (
      nextKey != null &&
      state.sampleDataKey != null &&
      state.processResult != null &&
      prevContent === nextContent
    ) {
      set({
        surveyRows: rows,
        sampleMeta: meta,
        lastPreset: preset,
        sampleDataKey: nextKey,
      });
      return false;
    }

    set({
      surveyRows: rows,
      sampleMeta: meta,
      lastPreset: preset,
      processResult: null,
      highlightedPeriodLabel: null,
      sampleGeneration: state.sampleGeneration + 1,
      sampleDataKey: nextKey,
    });
    return true;
  },
  beginSampleReload: () => set({ sampleDataKey: null }),
  setProcessResult: (result) => set({ processResult: result }),
  clearSurveyData: () =>
    set({
      surveyRows: [],
      sampleMeta: null,
      processResult: null,
      highlightedPeriodLabel: null,
      sampleGeneration: 0,
      sampleDataKey: null,
    }),
}));

useUiStore.subscribe((state) => {
  persistUiSession(state);
});
