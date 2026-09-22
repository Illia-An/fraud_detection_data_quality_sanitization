import { describe, expect, it } from 'vitest';

import {
  aggregateNetworkSeries,
  buildHighlightedMonthShape,
  buildStoreImpactTraces,
  buildStoreImpactXAxis,
  buildStoreImpactYAxis,
  buildTier4FlagMarkerTrace,
  buildTier4FlagShapes,
  buildYoYImpactTraces,
  collectStoreImpactYValues,
  computePeriodKpisFromPoints,
  defaultSelectedStoreId,
  filterFlaggedMonthsForStore,
  filterStoreSeries,
  getStoreIds,
  applyTraceHoverFocus,
  NETWORK_SERIES_STORE_ID,
  STORE_IMPACT_COLORS,
  STORE_IMPACT_HOVER_DIM_OPACITY,
  TIER4_BAND_FILL,
  TIER4_HIGHLIGHT_BAND_FILL,
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

  it('aggregates network series with volume-weighted rates', () => {
    const network = aggregateNetworkSeries(series);
    expect(network).toHaveLength(2);
    expect(network[0].store_id).toBe(NETWORK_SERIES_STORE_ID);
    expect(network[0].period_label).toBe('2025-01');
    // (95*40 + 80*30) / (40+30) = 88.5714…
    expect(network[0].actual_five_pct).toBeCloseTo((95 * 40 + 80 * 30) / 70, 4);
    // (88*40 + 79*30) / 70
    expect(network[0].after_tier1_five_pct).toBeCloseTo((88 * 40 + 79 * 30) / 70, 4);
    expect(network[0].actual_volume).toBe(70);
    expect(network[0].final_volume).toBe(64);
    // Only store 1 has 2025-02
    expect(network[1].period_label).toBe('2025-02');
    expect(network[1].actual_five_pct).toBe(70);
    expect(network[1].actual_volume).toBe(38);
  });

  it('computes store period KPIs from impact points', () => {
    const storePoints = filterStoreSeries(series, 1).map((point) => ({
      ...point,
      after_tier4_five_pct: point.after_tier2_five_pct,
    }));
    const kpis = computePeriodKpisFromPoints(storePoints);
    expect(kpis.baseline_top_box_pct).toBeCloseTo((95 * 40 + 70 * 38) / 78, 4);
    expect(kpis.final_top_box_pct).toBeCloseTo((85 * 40 + 67 * 38) / 78, 4);
    expect(kpis.delta_pp).toBeCloseTo(
      (kpis.final_top_box_pct ?? 0) - (kpis.baseline_top_box_pct ?? 0),
      4,
    );
  });

  it('builds YoY Actual+Final traces per year on shared month axis', () => {
    const withFinal = series.map((point) => ({
      ...point,
      after_tier4_five_pct: point.after_tier2_five_pct,
    }));
    const traces = buildYoYImpactTraces(filterStoreSeries(withFinal, 1));
    expect(traces.map((trace) => trace.name)).toEqual(['2025 · Actual', '2025 · Final']);
    expect(traces[0].x).toHaveLength(12);
    expect(traces[0].y[0]).toBe(95);
    expect(traces[0].y[1]).toBe(70);
    expect(traces[0].y[2]).toBeNull();
  });

  it('does not emit one row per store in network aggregation', () => {
    const network = aggregateNetworkSeries(series);
    const janPoints = network.filter((point) => point.period_label === '2025-01');
    expect(janPoints).toHaveLength(1);
  });

  it('builds actual and tier traces for all four tiers', () => {
    const traces = buildStoreImpactTraces(filterStoreSeries(series, 1));
    expect(traces).toHaveLength(5);
    expect(traces[0]).toMatchObject({
      name: 'Actual',
      line: { color: STORE_IMPACT_COLORS.actual, width: 2.5, dash: 'solid' },
    });
    expect(traces[1]).toMatchObject({
      name: 'After Tier 1 (BlackList)',
      line: { color: STORE_IMPACT_COLORS.tier1, width: 1.5, dash: 'dash' },
    });
    expect(traces[2]).toMatchObject({
      name: 'After Tier 2 (Frequency)',
      line: { color: STORE_IMPACT_COLORS.tier2, width: 1.5, dash: 'dashdot' },
    });
    expect(traces[3]).toMatchObject({
      name: 'After Tier 3 (Always top-box)',
      line: { color: STORE_IMPACT_COLORS.tier3, width: 1.5, dash: 'dot' },
    });
    expect(traces[4]).toMatchObject({
      name: 'After Tier 4 (Store×month)',
      line: { color: STORE_IMPACT_COLORS.tier4, width: 2.5, dash: 'solid' },
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

  it('filters flagged Tier 4 months for one store', () => {
    const cells = [
      {
        store_id: 1,
        year: 2025,
        month: 1,
        volume: 40,
        five_pct: 95,
        z: 2.4,
        flagged: true,
      },
      {
        store_id: 1,
        year: 2025,
        month: 2,
        volume: 38,
        five_pct: 70,
        z: 0.2,
        flagged: false,
      },
      {
        store_id: 2,
        year: 2025,
        month: 1,
        volume: 30,
        five_pct: 91,
        z: 2.1,
        flagged: true,
      },
    ];
    expect(filterFlaggedMonthsForStore(cells, 1)).toHaveLength(1);
    expect(filterFlaggedMonthsForStore(cells, 1)[0].month).toBe(1);
  });

  it('builds vertical Tier 4 bands on flagged category indices', () => {
    const shapes = buildTier4FlagShapes(
      ['2025-01', '2025-02'],
      [
        {
          store_id: 1,
          year: 2025,
          month: 1,
          volume: 40,
          five_pct: 95,
          z: 2.4,
          flagged: true,
        },
      ],
    );
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatchObject({
      type: 'rect',
      yref: 'paper',
      y0: 0,
      y1: 1,
      fillcolor: TIER4_BAND_FILL,
      layer: 'below',
    });
    expect(shapes[0].x0).toBeCloseTo(-0.45);
    expect(shapes[0].x1).toBeCloseTo(0.45);
  });

  it('forces categorical x-axis so YYYY-MM is not date-parsed', () => {
    expect(buildStoreImpactXAxis(['2025-01', '2025-02'])).toEqual({
      title: { text: 'Month' },
      type: 'category',
      categoryorder: 'array',
      categoryarray: ['2025-01', '2025-02'],
    });
  });

  it('builds a stronger highlight band for a selected period', () => {
    const shape = buildHighlightedMonthShape(['2025-01', '2025-02'], '2025-02');
    expect(shape).toMatchObject({
      fillcolor: TIER4_HIGHLIGHT_BAND_FILL,
      x0: 0.55,
      x1: 1.45,
    });
    expect(buildHighlightedMonthShape(['2025-01'], '2099-01')).toBeNull();
  });

  it('builds Tier 4 flag marker trace with z/volume tooltip data', () => {
    const points = filterStoreSeries(series, 1);
    const trace = buildTier4FlagMarkerTrace(points, [
      {
        store_id: 1,
        year: 2025,
        month: 1,
        volume: 40,
        five_pct: 95,
        z: 2.4,
        flagged: true,
      },
    ]);
    expect(trace).not.toBeNull();
    expect(trace).toMatchObject({
      name: 'Tier 4 flagged',
      x: ['2025-01'],
      y: [95],
      mode: 'markers',
      marker: { line: { color: STORE_IMPACT_COLORS.tier4Flag } },
    });
    expect(trace!.customdata).toEqual([[2.4, 40, 95]]);
  });

  it('dims sibling traces when one series is focused', () => {
    const traces = buildStoreImpactTraces(filterStoreSeries(series, 1));
    const focused = applyTraceHoverFocus(traces, 0);
    expect(focused[0].opacity).toBe(1);
    expect(focused[1].opacity).toBe(STORE_IMPACT_HOVER_DIM_OPACITY);
    expect(focused[4].opacity).toBe(STORE_IMPACT_HOVER_DIM_OPACITY);

    const clear = applyTraceHoverFocus(traces, null);
    expect(clear.every((trace) => trace.opacity === 1)).toBe(true);
  });
});
