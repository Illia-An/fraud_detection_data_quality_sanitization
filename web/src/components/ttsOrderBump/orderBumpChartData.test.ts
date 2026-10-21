import { describe, expect, it } from 'vitest';

import type { OrderBumpImpactPoint } from '../../schemas/ttsOrderBump';
import {
  TRACE_NAME_ACTUAL,
  TRACE_NAME_CYCLE,
  TRACE_NAME_GE30,
  TRACE_NAME_ORDER_RAW,
  aggregateOrderBumpNetworkSeries,
  buildOrderBumpTimelineTraces,
  buildOrderBumpYAxis,
  buildOrderBumpYoYTraces,
} from './orderBumpChartData';

const sample: OrderBumpImpactPoint[] = [
  {
    store_id: 100,
    year: 2026,
    month: 8,
    period_label: '2026-08',
    actual_mean_tts_sec: 80,
    after_ge30_mean_tts_sec: 100,
    order_tts_mean_sec: 240,
    order_tts_mean_after_sec: 220,
    cycle_mean_sec: 130,
    volume_before: 10,
    volume_after: 8,
    volume_cycle: 10,
  },
  {
    store_id: 101,
    year: 2026,
    month: 8,
    period_label: '2026-08',
    actual_mean_tts_sec: 120,
    after_ge30_mean_tts_sec: 140,
    order_tts_mean_sec: 260,
    order_tts_mean_after_sec: 250,
    cycle_mean_sec: 150,
    volume_before: 30,
    volume_after: 24,
    volume_cycle: 30,
  },
  {
    store_id: 100,
    year: 2026,
    month: 9,
    period_label: '2026-09',
    actual_mean_tts_sec: 90,
    after_ge30_mean_tts_sec: 110,
    order_tts_mean_sec: 250,
    order_tts_mean_after_sec: 240,
    cycle_mean_sec: 140,
    volume_before: 20,
    volume_after: 18,
    volume_cycle: 20,
  },
];

describe('orderBumpChartData', () => {
  it('aggregates network with order-weighted kitchen means', () => {
    const net = aggregateOrderBumpNetworkSeries(sample);
    const aug = net.find((p) => p.period_label === '2026-08');
    expect(aug).toBeDefined();
    expect(aug!.actual_mean_tts_sec).toBe(110);
    expect(aug!.after_ge30_mean_tts_sec).toBe(130);
    expect(aug!.order_tts_mean_sec).toBe(250);
    expect(aug!.cycle_mean_sec).toBe(145);
    expect(aug!.order_tts_mean_after_sec).toBe(235);
  });

  it('builds timeline traces for kitchen raw, kitchen ge30, and TransH', () => {
    const traces = buildOrderBumpTimelineTraces(
      sample.filter((p) => p.store_id === 100),
    );
    expect(traces.map((tr) => tr.name)).toEqual([
      TRACE_NAME_ACTUAL,
      TRACE_NAME_GE30,
      TRACE_NAME_ORDER_RAW,
      TRACE_NAME_CYCLE,
    ]);
    expect(traces[2].line?.dash).toBe('dot');
  });

  it('builds YoY traces per year', () => {
    const traces = buildOrderBumpYoYTraces(sample);
    expect(traces.some((tr) => tr.name === '2026 · Actual')).toBe(true);
    expect(traces.some((tr) => tr.name === '2026 · Order TTS')).toBe(true);
    expect(traces.some((tr) => tr.name === '2026 · Order after')).toBe(false);
  });

  it('fit vs from-zero Y axis', () => {
    const fit = buildOrderBumpYAxis('fit', [80, 140]);
    const full = buildOrderBumpYAxis('full', [80, 140]);
    expect(fit.range?.[0]).toBeGreaterThan(0);
    expect(full.range?.[0]).toBe(0);
    expect(full.range?.[1]).toBeGreaterThan(140);
  });
});
