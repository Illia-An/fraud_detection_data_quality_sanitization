import { describe, expect, it } from 'vitest';

import { defaultTtsPipelineConfig, type TtsSanitizationResponse } from './tts';
import {
  buildTtsSanitizedPanelFromProcess,
  cleanTtsSec,
  isTtsPanelReady,
  ttsSanitizedPanelToCsv,
} from './ttsSanitizedPanel';

const basePoint = {
  store_id: 10,
  year: 2026,
  month: 9,
  actual_mean_tts_sec: 200,
  after_ge30_mean_tts_sec: 218,
  volume_before: 1200,
  volume_after: 1100,
};

const sampleResult: TtsSanitizationResponse = {
  baseline_mean_tts_sec: 200,
  final_mean_tts_sec: 220,
  network_delta_sec: 20,
  steps: [],
  store_impact_series: [
    basePoint,
    {
      ...basePoint,
      store_id: 20,
      month: 10,
      after_ge30_mean_tts_sec: 240,
      volume_after: 500,
    },
  ],
  echo_config: defaultTtsPipelineConfig,
  meta: {
    execution_time_ms: 1,
    peak_memory_mb: 0.5,
    rows_scanned: 20,
    period_start: '2026-09-01',
    period_end: '2026-10-17',
  },
};

describe('ttsSanitizedPanel', () => {
  it('uses after_ge30 for clean tts_sec', () => {
    expect(cleanTtsSec(basePoint)).toBe(218);
  });

  it('returns null when ge30 is missing', () => {
    expect(
      cleanTtsSec({
        ...basePoint,
        after_ge30_mean_tts_sec: null,
      }),
    ).toBeNull();
  });

  it('builds panel with suggested reference = latest month', () => {
    const panel = buildTtsSanitizedPanelFromProcess(sampleResult);
    expect(panel.row_count).toBe(2);
    expect(panel.period_start).toBe('2026-09-01');
    expect(panel.period_end).toBe('2026-10-17');
    expect(panel.reference_year).toBe(2026);
    expect(panel.reference_month).toBe(10);
    expect(panel.rows[0]?.tts_sec).toBe(218);
    expect(panel.rows[0]?.volume).toBe(1100);
    expect(panel.echo_config.tts_min_sec).toBe(30);
    expect(isTtsPanelReady(panel)).toBe(true);
  });

  it('omits points with no cleansed tts', () => {
    const panel = buildTtsSanitizedPanelFromProcess({
      ...sampleResult,
      store_impact_series: [
        { ...basePoint, after_ge30_mean_tts_sec: null },
        basePoint,
      ],
    });
    expect(panel.row_count).toBe(1);
    expect(panel.rows[0]?.store_id).toBe(10);
  });

  it('exports CSV with tts_sec header', () => {
    const panel = buildTtsSanitizedPanelFromProcess(sampleResult);
    const csv = ttsSanitizedPanelToCsv(panel);
    expect(csv.split('\n')[0]).toBe('store_id,year,month,tts_sec,volume');
    expect(csv).toContain('10,2026,9,218,1100');
  });

  it('isTtsPanelReady is false for empty panel', () => {
    expect(isTtsPanelReady(null)).toBe(false);
    expect(
      isTtsPanelReady({
        period_start: null,
        period_end: null,
        echo_config: defaultTtsPipelineConfig,
        reference_year: null,
        reference_month: null,
        row_count: 0,
        rows: [],
      }),
    ).toBe(false);
  });
});
