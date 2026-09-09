import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('useUiStore survey data', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedStoreId: null,
      lastPreset: 'db',
      surveyRows: [],
      sampleMeta: null,
      sampleGeneration: 0,
      processResult: null,
    });
  });

  it('has default preset db and no selected store', () => {
    const state = useUiStore.getState();
    expect(state.lastPreset).toBe('db');
    expect(state.selectedStoreId).toBeNull();
    expect(state.surveyRows).toEqual([]);
    expect(state.sampleMeta).toBeNull();
    expect(state.sampleGeneration).toBe(0);
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
});
