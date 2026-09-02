import { describe, expect, it } from 'vitest';

import {
  defaultPipelineConfig,
  pipelineConfigSchema,
  processRequestSchema,
  processResponseSchema,
  sampleResponseSchema,
} from './api';

const sampleRow = {
  ParticipateNumber: 'p-1',
  Question_ID: 10012,
  Answer_Value: 5,
  BlackList: 'לא',
  UserContact: 'u1',
  PrintStore: 1,
  AnswerTime: '2025-01-01T10:00:00',
  Year: 2025,
  Month: 1,
  ContactType: 'SMS',
};

const sampleApiResponse = {
  preset: 'small',
  rows: [sampleRow],
  meta: {
    preset: 'small',
    row_count: 1,
    store_count: 1,
    month_count: 1,
    description: '2 stores × 2 months — quick chart demo with Tier 1/2 signals',
  },
};

const processApiResponse = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [
    {
      step_name: '0_raw_q10012',
      rows_in: 100,
      rows_out: 95,
      rows_dropped: 5,
      top_box_rate_pct: 85.5,
      drop_reasons: {},
    },
    {
      step_name: '1_tier1',
      rows_in: 95,
      rows_out: 90,
      rows_dropped: 5,
      top_box_rate_pct: 84.0,
      drop_reasons: { staff_blacklist: 3, freq_store_day: 2 },
    },
  ],
  high_store_months: [
    {
      store_id: 1,
      year: 2025,
      month: 1,
      volume: 40,
      five_pct: 95.0,
      z: 2.5,
      flagged: true,
    },
  ],
  store_impact_series: [
    {
      store_id: 1,
      year: 2025,
      month: 1,
      period_label: '2025-01',
      actual_five_pct: 95.0,
      after_tier1_five_pct: 88.0,
      after_tier2_five_pct: 85.0,
      after_tier3_five_pct: null,
      actual_volume: 40,
      final_volume: 35,
      rows_dropped: 5,
    },
  ],
  entities_flagged_tier3: 0,
  meta: { row_count_in: 100 },
};

describe('sampleResponseSchema', () => {
  it('parses a valid sample API response', () => {
    const parsed = sampleResponseSchema.parse(sampleApiResponse);
    expect(parsed.preset).toBe('small');
    expect(parsed.meta.row_count).toBe(1);
    expect(parsed.rows[0].ContactType).toBe('SMS');
  });

  it('rejects sample response missing meta fields', () => {
    expect(() =>
      sampleResponseSchema.parse({
        ...sampleApiResponse,
        meta: { preset: 'small', row_count: 1 },
      }),
    ).toThrow();
  });
});

describe('processResponseSchema', () => {
  it('parses all ProcessResponse fields', () => {
    const parsed = processResponseSchema.parse(processApiResponse);
    expect(parsed.baseline_top_box_pct).toBe(85.5);
    expect(parsed.final_top_box_pct).toBe(82.1);
    expect(parsed.network_delta_pp).toBe(-3.4);
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.high_store_months[0].flagged).toBe(true);
    expect(parsed.store_impact_series[0].after_tier1_five_pct).toBe(88.0);
    expect(parsed.entities_flagged_tier3).toBe(0);
    expect(parsed.meta.row_count_in).toBe(100);
  });
});

describe('pipelineConfigSchema', () => {
  it('applies backend defaults', () => {
    expect(defaultPipelineConfig.tier1.freq_store_day_min).toBe(3);
    expect(defaultPipelineConfig.tier2.enabled).toBe(true);
    expect(defaultPipelineConfig.tier3.enabled).toBe(false);
    expect(defaultPipelineConfig.tier3.contamination).toBe(0.005);
  });

  it('rejects invalid tier1 freq threshold', () => {
    expect(() =>
      pipelineConfigSchema.parse({
        tier1: { freq_store_day_min: 1 },
      }),
    ).toThrow();
  });

  it('rejects invalid tier2 z_high', () => {
    expect(() =>
      pipelineConfigSchema.parse({
        tier2: { z_high: 10 },
      }),
    ).toThrow();
  });
});

describe('processRequestSchema', () => {
  it('requires at least one row', () => {
    expect(() =>
      processRequestSchema.parse({
        rows: [],
        config: defaultPipelineConfig,
      }),
    ).toThrow();
  });

  it('accepts a valid process request', () => {
    const parsed = processRequestSchema.parse({
      rows: [sampleRow],
      config: defaultPipelineConfig,
    });
    expect(parsed.rows).toHaveLength(1);
  });
});
