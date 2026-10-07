import { describe, expect, it } from 'vitest';

import {
  applyFlaggedFilter,
  applyStoreSearch,
  countHighVolume,
  countHighZ,
  medianVolume,
} from './flaggedMonthsFilters';

const rows = [
  { store_id: 10, year: 2025, month: 1, volume: 20, five_pct: 90, z: 1.2, flagged: true },
  { store_id: 20, year: 2025, month: 1, volume: 40, five_pct: 92, z: 2.5, flagged: true },
  { store_id: 30, year: 2025, month: 2, volume: 60, five_pct: 95, z: 3.1, flagged: true },
  { store_id: 101, year: 2025, month: 3, volume: 10, five_pct: 88, z: 0.4, flagged: true },
];

describe('flaggedMonthsFilters', () => {
  it('computes median volume and high-z / high-volume counts', () => {
    expect(medianVolume(rows)).toBe(30);
    expect(countHighZ(rows)).toBe(2);
    expect(countHighVolume(rows, 30)).toBe(2);
  });

  it('filters by high_z and high_volume', () => {
    expect(applyFlaggedFilter(rows, 'high_z', 30).map((r) => r.store_id)).toEqual([20, 30]);
    expect(applyFlaggedFilter(rows, 'high_volume', 30).map((r) => r.store_id)).toEqual([20, 30]);
    expect(applyFlaggedFilter(rows, 'all', 30)).toHaveLength(4);
  });

  it('filters by store id substring', () => {
    expect(applyStoreSearch(rows, '10').map((r) => r.store_id)).toEqual([10, 101]);
    expect(applyStoreSearch(rows, ' 20 ').map((r) => r.store_id)).toEqual([20]);
    expect(applyStoreSearch(rows, '')).toHaveLength(4);
  });
});
