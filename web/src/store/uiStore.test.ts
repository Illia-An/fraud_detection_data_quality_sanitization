import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ selectedStoreId: null, lastPreset: 'small' });
  });

  it('has default preset small and no selected store', () => {
    const state = useUiStore.getState();
    expect(state.lastPreset).toBe('small');
    expect(state.selectedStoreId).toBeNull();
  });

  it('updates selectedStoreId and lastPreset', () => {
    useUiStore.getState().setSelectedStoreId(3);
    useUiStore.getState().setLastPreset('medium');

    const state = useUiStore.getState();
    expect(state.selectedStoreId).toBe(3);
    expect(state.lastPreset).toBe('medium');
  });
});
