import { create } from 'zustand';
import { z } from 'zod';

import type { ChartTimeMode } from '../schemas/chartUi';
import {
  orderBumpPresetSchema,
  orderBumpProcessResponseSchema,
  orderBumpRowSchema,
  orderBumpSamplePresetMetaSchema,
  type OrderBumpPreset,
  type OrderBumpProcessResponse,
  type OrderBumpRow,
  type OrderBumpSampleResponse,
} from '../schemas/ttsOrderBump';
import { readSessionJson, removeSessionKey, writeSessionJson } from './sessionPersist';

export const ORDER_BUMP_UI_SESSION_KEY = 'fraud-guard-tts-order-bump-ui';

type SampleMeta = OrderBumpSampleResponse['meta'];

interface OrderBumpUiState {
  selectedStoreId: number | null;
  lastPreset: OrderBumpPreset;
  chartScope: 'store' | 'network';
  chartTimeMode: ChartTimeMode;
  bumpRows: OrderBumpRow[];
  sampleMeta: SampleMeta | null;
  sampleGeneration: number;
  sampleDataKey: string | null;
  processResult: OrderBumpProcessResponse | null;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: OrderBumpPreset) => void;
  setChartScope: (scope: 'store' | 'network') => void;
  setChartTimeMode: (mode: ChartTimeMode) => void;
  setSampleData: (
    rows: OrderBumpRow[],
    meta: SampleMeta,
    preset: OrderBumpPreset,
    loadToken?: number,
  ) => boolean;
  setProcessResult: (result: OrderBumpProcessResponse | null) => void;
  clearSampleData: () => void;
}

function buildSampleKey(
  preset: OrderBumpPreset,
  meta: SampleMeta,
  rows: OrderBumpRow[],
  loadToken: number,
): string {
  return `${preset}:${loadToken}:${meta.row_count}:${meta.order_count}:${rows.length}`;
}

const sessionSchema = z.object({
  selectedStoreId: z.number().nullable(),
  lastPreset: orderBumpPresetSchema,
  chartScope: z.enum(['store', 'network']),
  chartTimeMode: z.enum(['timeline', 'yoy']),
  processResult: orderBumpProcessResponseSchema.nullable().optional(),
});

function loadSession(): Partial<OrderBumpUiState> {
  const raw = readSessionJson(ORDER_BUMP_UI_SESSION_KEY);
  if (!raw) {
    return {};
  }
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) {
    removeSessionKey(ORDER_BUMP_UI_SESSION_KEY);
    return {};
  }
  return {
    selectedStoreId: parsed.data.selectedStoreId,
    lastPreset: parsed.data.lastPreset,
    chartScope: parsed.data.chartScope,
    chartTimeMode: parsed.data.chartTimeMode,
    processResult: parsed.data.processResult ?? null,
  };
}

function persistSession(state: OrderBumpUiState): void {
  writeSessionJson(ORDER_BUMP_UI_SESSION_KEY, {
    selectedStoreId: state.selectedStoreId,
    lastPreset: state.lastPreset,
    chartScope: state.chartScope,
    chartTimeMode: state.chartTimeMode,
    processResult: state.processResult,
  });
}

const initial = loadSession();

export const useOrderBumpUiStore = create<OrderBumpUiState>((set, get) => ({
  selectedStoreId: initial.selectedStoreId ?? null,
  lastPreset: initial.lastPreset ?? 'small',
  chartScope: initial.chartScope ?? 'network',
  chartTimeMode: initial.chartTimeMode ?? 'timeline',
  bumpRows: [],
  sampleMeta: null,
  sampleGeneration: 0,
  sampleDataKey: null,
  processResult: initial.processResult ?? null,

  setSelectedStoreId: (storeId) => {
    set({ selectedStoreId: storeId });
    persistSession(get());
  },

  setLastPreset: (preset) => {
    set({ lastPreset: preset });
    persistSession(get());
  },

  setChartScope: (scope) => {
    set({ chartScope: scope });
    persistSession(get());
  },

  setChartTimeMode: (mode) => {
    set({ chartTimeMode: mode });
    persistSession(get());
  },

  setSampleData: (rows, meta, preset, loadToken = 0) => {
    const parsedRows = z.array(orderBumpRowSchema).parse(rows);
    const parsedMeta = orderBumpSamplePresetMetaSchema.parse(meta);
    const key = buildSampleKey(preset, parsedMeta, parsedRows, loadToken);
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
    }));
    persistSession(get());
    return true;
  },

  setProcessResult: (result) => {
    set({ processResult: result });
    persistSession(get());
  },

  clearSampleData: () => {
    set({
      bumpRows: [],
      sampleMeta: null,
      sampleDataKey: null,
      processResult: null,
    });
    persistSession(get());
  },
}));
