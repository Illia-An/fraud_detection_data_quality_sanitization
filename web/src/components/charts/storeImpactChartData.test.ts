import { describe, expect, it } from 'vitest';

import {
  buildStoreImpactTraces,
  buildStoreImpactYAxis,
  collectStoreImpactYValues,
  defaultSelectedStoreId,
  filterStoreSeries,
  getStoreIds,
  STORE_IMPACT_COLORS,
} from './storeImpactChartData';

const series = [
  {
    store_id: 1,
    year: 2025,
    month: 1,
    period_label: '2025-01',
    actual_five_pct: 95,
    after_tier1_five_pct: 88,
    after_tier2_five_pct: 85,
    actual_volume: 40,
    final_volume: 35,
    rows_dropped: 5,
  },
  {
    store_id: 1,
    year: 2025,
    month: 2,
    period_label: '2025-02',
    actual_five_pct: 70,
    after_tier1_five_pct: 68,
    after_tier2_five_pct: 67,
    actual_volume: 38,
    final_volume: 36,
    rows_dropped: 2,
  },
  {
    store_id: 2,
    year: 2025,
    month: 1,
    period_label: '2025-01',
    actual_five_pct: 80,
    after_tier1_five_pct: 79,
    after_tier2_five_pct: 78,
    actual_volume: 30,
    final_volume: 29,
    rows_dropped: 1,
  },
];

describe('storeImpactChartData', () => {
  it('extracts sorted store ids', () => {
    expect(getStoreIds(series)).toEqual([1, 2]);
  });

  it('defaults to store 1 when available', () => {
    expect(defaultSelectedStoreId(series, null)).toBe(1);
  });

  it('filters and sorts points for one store', () => {
    const points = filterStoreSeries(series, 1);
    expect(points).toHaveLength(2);
    expect(points[0].period_label).toBe('2025-01');
    expect(points[1].period_label).toBe('2025-02');
  });

  it('builds actual and tier traces for all four tiers', () => {
    const traces = buildStoreImpactTraces(filterStoreSeries(series, 1));
    expect(traces).toHaveLength(5);
    expect(traces[0]).toMatchObject({
      name: 'Actual',
      line: { color: STORE_IMPACT_COLORS.actual },
    });
    expect(traces[1]).toMatchObject({
      name: 'After Tier 1 (BlackList)',
      line: { color: STORE_IMPACT_COLORS.tier1 },
    });
    expect(traces[2]).toMatchObject({
      name: 'After Tier 2 (Frequency)',
      line: { color: STORE_IMPACT_COLORS.tier2 },
    });
    expect(traces[3]).toMatchObject({
      name: 'After Tier 3 (Always top-box)',
      line: { color: STORE_IMPACT_COLORS.tier3 },
    });
    expect(traces[4]).toMatchObject({
      name: 'After Tier 4 (Store×month)',
      line: { color: STORE_IMPACT_COLORS.tier4 },
    });
  });

  it('collects numeric y values across tiers', () => {
    expect(collectStoreImpactYValues(filterStoreSeries(series, 1))).toEqual([
      95, 88, 85, 70, 68, 67,
    ]);
  });

  it('builds full 0–100 y-axis', () => {
    expect(buildStoreImpactYAxis('full', [85, 90])).toEqual({
      title: { text: 'Top-box rate (%)' },
      range: [0, 100],
    });
  });

  it('builds fit y-axis zoomed to local data (no forced zero)', () => {
    const axis = buildStoreImpactYAxis('fit', [85, 90, 88]);
    expect(axis.range).toBeDefined();
    const [lo, hi] = axis.range!;
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThan(85);
    expect(hi).toBeGreaterThan(90);
    expect(hi).toBeLessThanOrEqual(100);
    expect(axis.rangemode).toBeUndefined();
  });
});
