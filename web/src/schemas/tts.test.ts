import { describe, expect, it } from 'vitest';

import {
  defaultTtsPipelineConfig,
  sortTtsSteps,
  ttsProcessRequestSchema,
  ttsSanitizationResponseSchema,
} from './tts';

describe('tts schemas', () => {
  it('defaults config to ge30=30 and order_agg=none', () => {
    expect(defaultTtsPipelineConfig).toEqual({
      tts_min_sec: 30,
      order_agg: 'none',
    });
  });

  it('rejects inline process without rows', () => {
    const parsed = ttsProcessRequestSchema.safeParse({
      source: 'inline',
      rows: [],
      config: {},
    });
    expect(parsed.success).toBe(false);
  });

  it('parses sanitization response contract', () => {
    const parsed = ttsSanitizationResponseSchema.parse({
      baseline_mean_tts_sec: 100,
      final_mean_tts_sec: 120,
      network_delta_sec: 20,
      steps: [
        {
          step_name: 'ge30',
          rows_in: 10,
          rows_out: 8,
          rows_dropped: 2,
          mean_tts_sec: 120,
          median_tts_sec: 110,
        },
        {
          step_name: 'actual',
          rows_in: 10,
          rows_out: 10,
          rows_dropped: 0,
          mean_tts_sec: 100,
          median_tts_sec: 90,
        },
      ],
      store_impact_series: [
        {
          store_id: 1,
          year: 2026,
          month: 9,
          actual_mean_tts_sec: 100,
          after_ge30_mean_tts_sec: 120,
          volume_before: 10,
          volume_after: 8,
        },
      ],
      echo_config: { tts_min_sec: 30, order_agg: 'none' },
      meta: { execution_time_ms: 1, rows_scanned: 10 },
    });
    expect(parsed.network_delta_sec).toBe(20);
    expect(sortTtsSteps(parsed.steps).map((s) => s.step_name)).toEqual([
      'actual',
      'ge30',
    ]);
  });
});
