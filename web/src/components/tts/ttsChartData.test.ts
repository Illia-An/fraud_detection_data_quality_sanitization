import { describe, expect, it } from 'vitest';

import {
  aggregateTtsNetworkSeries,
  buildTtsImpactTraces,
  getTtsStoreIds,
} from './ttsChartData';

describe('ttsChartData', () => {
  const series = [
    {
      store_id: 1,
      year: 2026,
      month: 9,
      actual_mean_tts_sec: 100,
      after_ge30_mean_tts_sec: 120,
      volume_before: 10,
      volume_after: 8,
    },
    {
      store_id: 2,
      year: 2026,
      month: 9,
      actual_mean_tts_sec: 200,
      after_ge30_mean_tts_sec: 220,
      volume_before: 10,
      volume_after: 8,
    },
  ];

  it('lists unique store ids', () => {
    expect(getTtsStoreIds(series)).toEqual([1, 2]);
  });

  it('aggregates network means volume-weighted', () => {
    const network = aggregateTtsNetworkSeries(series);
    expect(network).toHaveLength(1);
    expect(network[0]?.period_label).toBe('2026-09');
    expect(network[0]?.actual_mean_tts_sec).toBe(150);
    expect(network[0]?.after_ge30_mean_tts_sec).toBe(170);
  });

  it('builds actual + ge30 traces', () => {
    const traces = buildTtsImpactTraces(aggregateTtsNetworkSeries(series), {
      actual: 'Actual',
      ge30: 'After ge30',
    });
    expect(traces).toHaveLength(2);
    expect(traces[0]?.y).toEqual([150]);
    expect(traces[1]?.y).toEqual([170]);
  });
});
