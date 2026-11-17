import { describe, expect, it } from 'vitest';

import {
  availablePeriodReferences,
  baselineRowsAtReference,
  equalWeightMean,
  equalWeightMeanBy,
} from './plannerBaseline';

describe('availablePeriodReferences', () => {
  it('dedupes and sorts year/month pairs', () => {
    expect(
      availablePeriodReferences([
        { year: 2025, month: 3 },
        { year: 2025, month: 1 },
        { year: 2025, month: 3 },
        { year: 2024, month: 12 },
      ]),
    ).toEqual([
      { year: 2024, month: 12 },
      { year: 2025, month: 1 },
      { year: 2025, month: 3 },
    ]);
  });
});

describe('baselineRowsAtReference', () => {
  it('filters and maps metric fields', () => {
    const rows = [
      { store_id: 1, year: 2025, month: 2, five_percent: 70, tts: 4.1 },
      { store_id: 2, year: 2025, month: 3, five_percent: 80, tts: 3.5 },
      { store_id: 3, year: 2025, month: 2, five_percent: 60, tts: 5.0 },
    ];
    expect(
      baselineRowsAtReference(rows, 2025, 2, (row) => ({
        store_id: row.store_id,
        five_percent: row.five_percent,
      })),
    ).toEqual([
      { store_id: 1, five_percent: 70 },
      { store_id: 3, five_percent: 60 },
    ]);
    expect(
      baselineRowsAtReference(rows, 2025, 2, (row) => ({
        store_id: row.store_id,
        tts: row.tts,
      })),
    ).toEqual([
      { store_id: 1, tts: 4.1 },
      { store_id: 3, tts: 5.0 },
    ]);
  });
});

describe('equalWeightMean', () => {
  it('returns null for empty and mean otherwise', () => {
    expect(equalWeightMean([])).toBeNull();
    expect(equalWeightMean([70, 80])).toBe(75);
    expect(equalWeightMeanBy([{ tts: 4 }, { tts: 6 }], (r) => r.tts)).toBe(5);
  });
});
