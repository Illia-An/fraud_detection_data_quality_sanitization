import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('useUiStore survey data', () => {
  beforeEach(() => {
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
    useUiStore.getState().setSurveyData(
      [{ PrintStore: 1 }],
      {
        preset: 'medium',
        row_count: 10,
        store_count: 2,
        month_count: 3,
        description: 'test',
      },
      'medium',
    );

    const state = useUiStore.getState();
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
