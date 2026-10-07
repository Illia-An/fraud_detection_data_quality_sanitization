/** View filters for Flagged store×months panel (chips + store search). */

import type { StoreMonthCell } from '../schemas/api';

export type FlaggedFilter = 'all' | 'high_z' | 'high_volume';

/** Aligns with default Tier 4 z_threshold. */
export const HIGH_Z_THRESHOLD = 2;

export function medianVolume(rows: StoreMonthCell[]): number {
  if (rows.length === 0) {
    return 0;
  }
  const sorted = [...rows].map((row) => row.volume).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function countHighZ(rows: StoreMonthCell[]): number {
  return rows.filter((row) => Math.abs(row.z) >= HIGH_Z_THRESHOLD).length;
}

export function countHighVolume(rows: StoreMonthCell[], volumeFloor: number): number {
  return rows.filter((row) => row.volume >= volumeFloor).length;
}

export function applyFlaggedFilter(
  rows: StoreMonthCell[],
  filter: FlaggedFilter,
  volumeFloor: number,
): StoreMonthCell[] {
  if (filter === 'high_z') {
    return rows.filter((row) => Math.abs(row.z) >= HIGH_Z_THRESHOLD);
  }
  if (filter === 'high_volume') {
    return rows.filter((row) => row.volume >= volumeFloor);
  }
  return rows;
}

export function applyStoreSearch(rows: StoreMonthCell[], query: string): StoreMonthCell[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return rows;
  }
  return rows.filter((row) => String(row.store_id).includes(trimmed));
}
