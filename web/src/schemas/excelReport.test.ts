import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from './api';
import {
  buildExcelReportRequest,
  buildTtsExcelReportRequest,
  sanitizationMethodLabel,
  ttsBaselineMethodLabel,
} from './excelReport';
import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import type { TtsKpiPanel } from './ttsKpiPanel';
import type { TtsPlan } from './ttsPlan';

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: { ...defaultPipelineConfig, tier4_enabled: false, tier2_freq_enabled: false },
  reference_year: 2025,
  reference_month: 12,
  row_count: 1,
  rows: [{ store_id: 270, year: 2025, month: 12, five_percent: 64.3, survey_volume: 40 }],
};

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 64.3,
  required_change: 10.7,
  final_chain: 75,
  feasible: true,
  chain_trajectory: [{ year: 2026, month: 1, score: 75 }],
  projections: [{ store_id: 270, months: [{ year: 2026, month: 1, score: 75 }] }],
};

describe('buildExcelReportRequest', () => {
  it('copies the cleansed score and the plan target', () => {
    const request = buildExcelReportRequest(panel, plan);
    expect(request.method).toBe('tier1+tier3');
    expect(request.target).toBe(75);
    expect(request.sanitization_rows[0]?.score).toBe(64.3);
    expect(request.store_plans[0]?.months[0]?.score).toBe(75);
  });

  it('names no method when every tier is off', () => {
    expect(
      sanitizationMethodLabel({
        ...defaultPipelineConfig,
        tier1_blacklist_enabled: false,
        tier2_freq_enabled: false,
        tier3_always_five_enabled: false,
        tier4_enabled: false,
      }),
    ).toBe('none');
  });
});

const ttsPanel: TtsKpiPanel = {
  preset: 'ap',
  source: 'ap',
  period_start: '2025-11-01',
  period_end: '2025-12-01',
  reference_year: 2025,
  reference_month: 12,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 12, tts: 4.2 }],
};

const ttsPlan: TtsPlan = {
  metric_id: 'tts',
  unit: 'min',
  direction: 'lower_is_better',
  target: 3.5,
  current_chain: 4.2,
  required_change: 0.7,
  final_chain: 3.5,
  feasible: true,
  chain_trajectory: [{ year: 2026, month: 1, score: 3.5 }],
  projections: [{ store_id: 10, months: [{ year: 2026, month: 1, score: 3.5 }] }],
};

describe('buildTtsExcelReportRequest', () => {
  it('copies TTS minutes and the plan target', () => {
    const request = buildTtsExcelReportRequest(ttsPanel, ttsPlan);
    expect(request.method).toBe('tts_kpi:ap:ap');
    expect(ttsBaselineMethodLabel(ttsPanel)).toBe('tts_kpi:ap:ap');
    expect(request.target).toBe(3.5);
    expect(request.sanitization_rows[0]?.score).toBe(4.2);
    expect(request.store_plans[0]?.months[0]?.score).toBe(3.5);
  });
});
