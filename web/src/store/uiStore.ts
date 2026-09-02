import { create } from 'zustand';

import type { SamplePreset } from '../schemas/api';

interface UiState {
  selectedStoreId: number | null;
  lastPreset: SamplePreset;
  setSelectedStoreId: (storeId: number | null) => void;
  setLastPreset: (preset: SamplePreset) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: null,
  lastPreset: 'small',
  setSelectedStoreId: (storeId) => set({ selectedStoreId: storeId }),
  setLastPreset: (preset) => set({ lastPreset: preset }),
}));
