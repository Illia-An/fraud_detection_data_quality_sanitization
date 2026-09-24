import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from './api';
import type { ProcessResponse } from './api';
import {
  buildSanitizedPanelFromProcess,
  cleanFivePercent,
  sanitizedPanelToCsv,
} from './sanitizedPanel';

const basePoint = {
  store_id: 10,
  year: 2025,
  month: 3,
  period_label: '2025-03',
  actual_five_pct: 80,
  after_tier1_five_pct: 78,
  after_tier2_five_pct: 76,
  after_tier3_five_pct: null as number | null,
  after_tier4_five_pct: 74,
  actual_volume: 100,
  final_volume: 90,
  rows_dropped: 10,
};

const sampleResult: ProcessResponse = {
  baseline_top_box_pct: 80,
  final_top_box_pct: 74,
  network_delta_pp: -6,
  steps: [],
  high_store_months: [],
  store_impact_series: [
    basePoint,
    {
      ...basePoint,
      store_id: 20,
      month: 4,
      period_label: '2025-04',
      after_tier4_five_pct: 70,
      final_volume: 50,
    },
  ],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 1,
    peak_memory_mb: 0.5,
    rows_scanned: 20,
    period_start: '2025-01-01',
    period_end: null,
  },
};

describe('sanitizedPanel', () => {
  it('prefers after_tier4 for clean five_percent', () => {
    expect(cleanFivePercent(basePoint)).toBe(74);
  });

  it('falls back when later tiers are null', () => {
    expect(
      cleanFivePercent({
        ...basePoint,
        after_tier4_five_pct: null,
        after_tier3_five_pct: null,
        after_tier2_five_pct: 76,
      }),
    ).toBe(76);
  });

  it('builds panel with suggested reference = latest month', () => {
    const panel = buildSanitizedPanelFromProcess(sampleResult);
    expect(panel.row_count).toBe(2);
    expect(panel.period_start).toBe('2025-01-01');
    expect(panel.reference_year).toBe(2025);
    expect(panel.reference_month).toBe(4);
    expect(panel.rows[0].five_percent).toBe(74);
    expect(panel.rows[0].survey_volume).toBe(90);
  });

  it('omits points with no cleansed pct', () => {
    const panel = buildSanitizedPanelFromProcess({
      ...sampleResult,
      store_impact_series: [
        {
          ...basePoint,
          after_tier1_five_pct: null,
          after_tier2_five_pct: null,
          after_tier3_five_pct: null,
          after_tier4_five_pct: null,
        },
      ],
    });
    expect(panel.row_count).toBe(0);
    expect(panel.reference_year).toBeNull();
  });

  it('serializes CSV with header', () => {
    const panel = buildSanitizedPanelFromProcess(sampleResult);
    const csv = sanitizedPanelToCsv(panel);
    expect(csv.split('\n')[0]).toBe('store_id,year,month,five_percent,survey_volume');
    expect(csv).toContain('10,2025,3,74,90');
  });
});
