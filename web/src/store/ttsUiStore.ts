import { create } from 'zustand';
import { z } from 'zod';

import {
  ttsDataSourceSchema,
  ttsSamplePresetMetaSchema,
  ttsSanitizationResponseSchema,
  ttsBumpRowSchema,
  type TtsBumpRow,
  type TtsDataSource,
  type TtsSamplePresetMeta,
  type TtsSanitizationResponse,
} from '../schemas/tts';
import {
  buildTtsSanitizedPanelFromProcess,
  ttsSanitizedPanelSchema,
  type TtsSanitizedPanel,
} from '../schemas/ttsSanitizedPanel';
import {
  DEFAULT_PERIOD_PRESET,
  periodPresetSchema,
  type PeriodPreset,
} from '../schemas/period';
import { readSessionJson, removeSessionKey, writeSessionJson } from './sessionPersist';

export const TTS_UI_SESSION_STORAGE_KEY = 'fraud-guard-tts-ui-session';

interface TtsUiState {
  selectedStoreId: number | null;
  lastPreset: TtsDataSource;
  periodPreset: PeriodPreset;
  customFromDate: string;
  customToDate: string;
  chartScope: 'store' | 'network';
  bumpRows: TtsBumpRow[];
  sampleMeta: TtsSamplePresetMeta | null;
  sampleGeneration: number;
  sampleDataKey: string | null;
  processResult: TtsSanitizationResponse | null;
  /** Stage 5 cleansed store×month panel for Stage 6 planner gate. */
  sanitizedPanel: TtsSanitizedPanel | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: TtsDataSource) => void;
  setPeriodPreset: (preset: PeriodPreset) => void;
  setCustomPeriod: (fromDate: string, toDate: string) => void;
  setChartScope: (scope: 'store' | 'network') => void;
  setSampleData: (
    rows: TtsBumpRow[],
    meta: TtsSamplePresetMeta,
    preset: TtsDataSource,
    loadToken?: number,
  ) => boolean;
  beginSampleReload: () => void;
  setProcessResult: (result: TtsSanitizationResponse | null) => void;
  clearSampleData: () => void;
  /** Mark DB source ready for Run without loading bump rows into memory. */
  markDbReady: (meta: TtsSamplePresetMeta) => void;
}

export function buildTtsSampleDataKey(
  preset: TtsDataSource,
  meta: TtsSamplePresetMeta,
  rows: TtsBumpRow[],
  loadToken: number,
): string {
  return `${preset}:${loadToken}:${meta.row_count}:${meta.store_count}:${meta.month_count}:${rows.length}`;
}

function panelFromResult(
  result: TtsSanitizationResponse | null,
): TtsSanitizedPanel | null {
  if (!result) {
    return null;
  }
  return buildTtsSanitizedPanelFromProcess(result);
}

const ttsSessionSchema = z.object({
  selectedStoreId: z.number().nullable(),
  lastPreset: ttsDataSourceSchema,
  periodPreset: periodPresetSchema,
  customFromDate: z.string(),
  customToDate: z.string(),
  chartScope: z.enum(['store', 'network']),
  processResult: ttsSanitizationResponseSchema.nullable().optional(),
  sanitizedPanel: ttsSanitizedPanelSchema.nullable().optional(),
});

function loadSession(): Partial<TtsUiState> {
  const raw = readSessionJson(TTS_UI_SESSION_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  const parsed = ttsSessionSchema.safeParse(raw);
  if (!parsed.success) {
    removeSessionKey(TTS_UI_SESSION_STORAGE_KEY);
    return {};
  }
  const processResult = parsed.data.processResult ?? null;
  const sanitizedPanel =
    parsed.data.sanitizedPanel ?? panelFromResult(processResult);
  return {
    selectedStoreId: parsed.data.selectedStoreId,
    lastPreset: parsed.data.lastPreset,
    periodPreset: parsed.data.periodPreset,
    customFromDate: parsed.data.customFromDate,
    customToDate: parsed.data.customToDate,
    chartScope: parsed.data.chartScope,
    processResult,
    sanitizedPanel,
  };
}

function persistSession(state: TtsUiState): void {
  writeSessionJson(TTS_UI_SESSION_STORAGE_KEY, {
    selectedStoreId: state.selectedStoreId,
    lastPreset: state.lastPreset,
    periodPreset: state.periodPreset,
    customFromDate: state.customFromDate,
    customToDate: state.customToDate,
    chartScope: state.chartScope,
    processResult: state.processResult,
    sanitizedPanel: state.sanitizedPanel,
  });
}

const initialSession = loadSession();

export const useTtsUiStore = create<TtsUiState>((set, get) => ({
  selectedStoreId: initialSession.selectedStoreId ?? null,
  lastPreset: initialSession.lastPreset ?? 'small',
  periodPreset: initialSession.periodPreset ?? DEFAULT_PERIOD_PRESET,
  customFromDate: initialSession.customFromDate ?? '2025-01-01',
  customToDate: initialSession.customToDate ?? '',
  chartScope: initialSession.chartScope ?? 'network',
  bumpRows: [],
  sampleMeta: null,
  sampleGeneration: 0,
  sampleDataKey: null,
  processResult: initialSession.processResult ?? null,
  sanitizedPanel: initialSession.sanitizedPanel ?? null,

  setSelectedStoreId: (storeId) => {
    set({ selectedStoreId: storeId });
    persistSession(get());
  },

  setLastPreset: (preset) => {
    set({ lastPreset: preset });
    persistSession(get());
  },

  setPeriodPreset: (preset) => {
    set({ periodPreset: preset });
    persistSession(get());
  },

  setCustomPeriod: (fromDate, toDate) => {
    set({ customFromDate: fromDate, customToDate: toDate });
    persistSession(get());
  },

  setChartScope: (scope) => {
    set({ chartScope: scope });
    persistSession(get());
  },

  setSampleData: (rows, meta, preset, loadToken = 0) => {
    const parsedRows = z.array(ttsBumpRowSchema).parse(rows);
    const parsedMeta = ttsSamplePresetMetaSchema.parse(meta);
    const key = buildTtsSampleDataKey(preset, parsedMeta, parsedRows, loadToken);
    if (get().sampleDataKey === key) {
      return false;
    }
    set((state) => ({
      bumpRows: parsedRows,
      sampleMeta: parsedMeta,
      lastPreset: preset,
      sampleDataKey: key,
      sampleGeneration: state.sampleGeneration + 1,
      processResult: null,
      sanitizedPanel: null,
    }));
    persistSession(get());
    return true;
  },

  beginSampleReload: () => {
    set({ sampleDataKey: null });
  },

  setProcessResult: (result) => {
    set({
      processResult: result,
      sanitizedPanel: panelFromResult(result),
    });
    persistSession(get());
  },

  clearSampleData: () => {
    set({
      bumpRows: [],
      sampleMeta: null,
      sampleDataKey: null,
      processResult: null,
      sanitizedPanel: null,
    });
    persistSession(get());
  },

  markDbReady: (meta) => {
    const parsedMeta = ttsSamplePresetMetaSchema.parse(meta);
    set((state) => ({
      bumpRows: [],
      sampleMeta: parsedMeta,
      lastPreset: 'db',
      sampleDataKey: `db-ready:${parsedMeta.row_count}`,
      sampleGeneration: state.sampleGeneration + 1,
      processResult: null,
      sanitizedPanel: null,
    }));
    persistSession(get());
  },
}));
