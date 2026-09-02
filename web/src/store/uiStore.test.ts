import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('useUiStore survey data', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedStoreId: null,
      lastPreset: 'small',
      surveyRows: [],
      sampleMeta: null,
    });
  });

  it('has default preset small and no selected store', () => {
    const state = useUiStore.getState();
    expect(state.lastPreset).toBe('small');
    expect(state.selectedStoreId).toBeNull();
    expect(state.surveyRows).toEqual([]);
    expect(state.sampleMeta).toBeNull();
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
  });
});
