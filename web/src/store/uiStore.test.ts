import { beforeEach, describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import type { ProcessResponse } from '../schemas/api';
import {
  UI_SESSION_STORAGE_KEY,
  useUiStore,
} from './uiStore';

const sampleMeta = {
  preset: 'medium' as const,
  row_count: 10,
  store_count: 2,
  month_count: 3,
  description: 'test',
};

const validProcessResult: ProcessResponse = {
  baseline_top_box_pct: 80,
  final_top_box_pct: 74,
  network_delta_pp: -6,
  steps: [],
  high_store_months: [],
  store_impact_series: [],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 1,
    peak_memory_mb: 0.5,
    rows_scanned: 20,
  },
};

describe('useUiStore survey data', () => {
  beforeEach(() => {
    sessionStorage.removeItem(UI_SESSION_STORAGE_KEY);
    useUiStore.setState({
      selectedStoreId: null,
      highlightedPeriodLabel: null,
      lastPreset: 'db',
      periodPreset: 'from_2025',
      customFromDate: '2025-01-01',
      customToDate: '',
      chartScope: 'store',
      chartTimeMode: 'timeline',
      surveyRows: [],
      sampleMeta: null,
      sampleGeneration: 0,
      sampleDataKey: null,
      processResult: null,
    });
  });

  it('has default preset db and no selected store', () => {
    const state = useUiStore.getState();
    expect(state.lastPreset).toBe('db');
    expect(state.periodPreset).toBe('from_2025');
    expect(state.chartScope).toBe('store');
    expect(state.chartTimeMode).toBe('timeline');
    expect(state.selectedStoreId).toBeNull();
    expect(state.highlightedPeriodLabel).toBeNull();
    expect(state.surveyRows).toEqual([]);
    expect(state.sampleMeta).toBeNull();
    expect(state.sampleGeneration).toBe(0);
    expect(state.sampleDataKey).toBeNull();
  });

  it('updates period preset and custom range', () => {
    useUiStore.getState().setPeriodPreset('custom');
    useUiStore.getState().setCustomPeriod('2026-02-01', '2026-02-28');
    const state = useUiStore.getState();
    expect(state.periodPreset).toBe('custom');
    expect(state.customFromDate).toBe('2026-02-01');
    expect(state.customToDate).toBe('2026-02-28');
  });

  it('updates chart scope and time mode', () => {
    useUiStore.getState().setChartScope('network');
    useUiStore.getState().setChartTimeMode('yoy');
    expect(useUiStore.getState().chartScope).toBe('network');
    expect(useUiStore.getState().chartTimeMode).toBe('yoy');
  });

  it('updates selectedStoreId, lastPreset, and survey data', () => {
    useUiStore.getState().setSelectedStoreId(3);
    useUiStore.getState().setLastPreset('medium');
    const applied = useUiStore.getState().setSurveyData(
      [{ PrintStore: 1 }],
      sampleMeta,
      'medium',
    );

    const state = useUiStore.getState();
    expect(applied).toBe(true);
    expect(state.selectedStoreId).toBe(3);
    expect(state.lastPreset).toBe('medium');
    expect(state.surveyRows).toHaveLength(1);
    expect(state.sampleMeta?.row_count).toBe(10);
    expect(state.sampleGeneration).toBe(1);
  });

  it('accepts db as a data source', () => {
    useUiStore.getState().setSurveyData(
      [{ PrintStore: 82 }],
      {
        preset: 'db',
        row_count: 5,
        store_count: 5,
        month_count: 1,
        description: 'from db',
      },
      'db',
    );
    expect(useUiStore.getState().lastPreset).toBe('db');
    expect(useUiStore.getState().sampleMeta?.preset).toBe('db');
  });

  it('skips identical loadToken and preserves processResult', () => {
    useUiStore.getState().setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);
    useUiStore.getState().setProcessResult(validProcessResult);

    const applied = useUiStore
      .getState()
      .setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);

    expect(applied).toBe(false);
    expect(useUiStore.getState().sampleGeneration).toBe(1);
    expect(useUiStore.getState().processResult).toEqual(validProcessResult);
  });

  it('soft-keeps processResult when loadToken changes but content matches', () => {
    useUiStore.getState().setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);
    useUiStore.getState().setProcessResult(validProcessResult);

    const applied = useUiStore
      .getState()
      .setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 999);

    expect(applied).toBe(false);
    expect(useUiStore.getState().sampleGeneration).toBe(1);
    expect(useUiStore.getState().processResult).toEqual(validProcessResult);
    expect(useUiStore.getState().sampleDataKey).toContain(':999:');
  });

  it('beginSampleReload forces a full apply on the next loadToken', () => {
    useUiStore.getState().setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);
    useUiStore.getState().setProcessResult(validProcessResult);
    useUiStore.getState().beginSampleReload();

    const applied = useUiStore
      .getState()
      .setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 200);

    expect(applied).toBe(true);
    expect(useUiStore.getState().sampleGeneration).toBe(2);
    expect(useUiStore.getState().processResult).toBeNull();
  });

  it('applies a new loadToken and clears processResult when content changes', () => {
    useUiStore.getState().setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);
    useUiStore.getState().setProcessResult(validProcessResult);

    const applied = useUiStore.getState().setSurveyData(
      [{ PrintStore: 1 }, { PrintStore: 2 }],
      { ...sampleMeta, row_count: 11 },
      'medium',
      200,
    );

    expect(applied).toBe(true);
    expect(useUiStore.getState().sampleGeneration).toBe(2);
    expect(useUiStore.getState().processResult).toBeNull();
  });

  it('persists processResult to sessionStorage', () => {
    useUiStore.getState().setSurveyData([{ PrintStore: 1 }], sampleMeta, 'medium', 100);
    useUiStore.getState().setProcessResult(validProcessResult);

    const raw = sessionStorage.getItem(UI_SESSION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { processResult: ProcessResponse | null };
    expect(parsed.processResult?.final_top_box_pct).toBe(74);
  });

  it('selectFlaggedStoreMonth sets store and period highlight together', () => {
    useUiStore.getState().selectFlaggedStoreMonth(82, 2026, 3);
    const state = useUiStore.getState();
    expect(state.selectedStoreId).toBe(82);
    expect(state.highlightedPeriodLabel).toBe('2026-03');
  });

  it('clears highlight when store is changed via selector', () => {
    useUiStore.getState().selectFlaggedStoreMonth(82, 2026, 3);
    useUiStore.getState().setSelectedStoreId(1);
    expect(useUiStore.getState().selectedStoreId).toBe(1);
    expect(useUiStore.getState().highlightedPeriodLabel).toBeNull();
  });
});
