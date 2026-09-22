import { describe, expect, it } from 'vitest';

import {
  defaultPipelineConfig,
  formatPipelineStepLabel,
  pipelineConfigSchema,
  processRequestSchema,
  processResponseSchema,
  sampleResponseSchema,
  sortPipelineSteps,
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
      step_name: 'tier1' as const,
      rows_in: 95,
      rows_out: 90,
      rows_dropped: 5,
      top_box_pct: 84.0,
    },
    {
      step_name: 'actual' as const,
      rows_in: 100,
      rows_out: 95,
      rows_dropped: 5,
      top_box_pct: 85.5,
    },
    {
      step_name: 'tier2' as const,
      rows_in: 90,
      rows_out: 88,
      rows_dropped: 2,
      top_box_pct: 82.1,
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
      actual_volume: 40,
      final_volume: 35,
      rows_dropped: 5,
    },
  ],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 12.5,
    peak_memory_mb: 1.2,
    rows_scanned: 100,
  },
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

describe('processResponseSchema / SanitizationResponse', () => {
  it('parses SPEC response with echo_config and telemetry meta', () => {
    const parsed = processResponseSchema.parse(processApiResponse);
    expect(parsed.baseline_top_box_pct).toBe(85.5);
    expect(parsed.echo_config.tier2_freq_threshold).toBe(3);
    expect(parsed.meta.execution_time_ms).toBe(12.5);
    expect(parsed.meta.peak_memory_mb).toBe(1.2);
    expect(parsed.meta.rows_scanned).toBe(100);
    expect(parsed.steps[0].top_box_pct).toBe(84.0);
  });

  it('rejects missing echo_config', () => {
    const { echo_config: _echoConfig, ...rest } = processApiResponse;
    void _echoConfig;
    expect(() => processResponseSchema.parse(rest)).toThrow();
  });

  it('rejects meta without telemetry keys', () => {
    expect(() =>
      processResponseSchema.parse({
        ...processApiResponse,
        meta: { row_count_in: 100 },
      }),
    ).toThrow();
  });
});

describe('sortPipelineSteps', () => {
  it('orders actual → tier1 → tier2 → tier3 → tier4', () => {
    const ordered = sortPipelineSteps([
      ...processApiResponse.steps,
      {
        step_name: 'tier4' as const,
        rows_in: 88,
        rows_out: 87,
        rows_dropped: 1,
        top_box_pct: 81.5,
      },
      {
        step_name: 'tier3' as const,
        rows_in: 90,
        rows_out: 89,
        rows_dropped: 1,
        top_box_pct: 81.8,
      },
    ]);
    expect(ordered.map((s) => s.step_name)).toEqual([
      'actual',
      'tier1',
      'tier2',
      'tier3',
      'tier4',
    ]);
  });
});

describe('formatPipelineStepLabel', () => {
  it('maps step names to human-readable labels', () => {
    expect(formatPipelineStepLabel('actual')).toBe('Actual (baseline)');
    expect(formatPipelineStepLabel('tier1')).toBe('Tier 1 — BlackList');
    expect(formatPipelineStepLabel('tier4')).toBe('Tier 4 — Store×month');
  });
});

describe('pipelineConfigSchema', () => {
  it('applies SPEC flat defaults', () => {
    expect(defaultPipelineConfig.tier2_freq_threshold).toBe(3);
    expect(defaultPipelineConfig.tier2_freq_enabled).toBe(true);
    expect(defaultPipelineConfig.tier1_blacklist_enabled).toBe(true);
    expect(defaultPipelineConfig.tier4_enabled).toBe(true);
    expect(defaultPipelineConfig.tier4_min_volume).toBe(30);
  });

  it('migrates legacy config keys', () => {
    const parsed = pipelineConfigSchema.parse({
      tier1_freq_threshold: 4,
      tier2_min_volume: 25,
    });
    expect(parsed.tier2_freq_threshold).toBe(4);
    expect(parsed.tier4_min_volume).toBe(25);
  });

  it('rejects invalid tier2 freq threshold', () => {
    expect(() =>
      pipelineConfigSchema.parse({
        tier2_freq_threshold: 0,
      }),
    ).toThrow();
    expect(() =>
      pipelineConfigSchema.parse({
        tier2_freq_threshold: 1,
      }),
    ).toThrow();
  });

  it('rejects invalid tier4 pct', () => {
    expect(() =>
      pipelineConfigSchema.parse({
        tier4_pct_threshold: 150,
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
    expect(parsed.source).toBe('inline');
  });

  it('allows empty rows when source is db', () => {
    const parsed = processRequestSchema.parse({
      source: 'db',
      config: defaultPipelineConfig,
    });
    expect(parsed.source).toBe('db');
    expect(parsed.rows).toEqual([]);
  });

  it('accepts optional from_date and to_date for db', () => {
    const parsed = processRequestSchema.parse({
      source: 'db',
      from_date: '2026-01-01',
      to_date: '2026-09-14',
      config: defaultPipelineConfig,
    });
    expect(parsed.from_date).toBe('2026-01-01');
    expect(parsed.to_date).toBe('2026-09-14');
  });

  it('rejects from_date after to_date', () => {
    expect(() =>
      processRequestSchema.parse({
        source: 'db',
        from_date: '2026-06-01',
        to_date: '2026-01-01',
        config: defaultPipelineConfig,
      }),
    ).toThrow();
  });
});
