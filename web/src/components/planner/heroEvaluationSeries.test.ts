import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { buildHeroEvaluationSeries } from './heroEvaluationSeries';

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 3,
  rows: [
    { store_id: 10, year: 2025, month: 2, five_percent: 68, survey_volume: 80 },
    { store_id: 20, year: 2025, month: 2, five_percent: 72, survey_volume: 90 },
    { store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 85 },
    { store_id: 20, year: 2025, month: 3, five_percent: 74, survey_volume: 95 },
  ],
};

const draft: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 72,
  required_change: 3,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 73 },
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    { store_id: 10, months: [{ year: 2025, month: 4, score: 71 }] },
    { store_id: 20, months: [{ year: 2025, month: 4, score: 75 }] },
  ],
};

describe('buildHeroEvaluationSeries', () => {
  it('puts cleansed fact left of as-of and draft forecast from as-of onward', () => {
    const series = buildHeroEvaluationSeries(draft, null, panel, { year: 2025, month: 3 }, 1.5);

    expect(series.asOfLabel).toBe('2025-03');
    expect(series.labels).toEqual(['2025-02', '2025-03', '2025-04', '2025-05']);
    // Feb network avg (68+72)/2 = 70; Mar (70+74)/2 = 72
    expect(series.factYs[0]).toBeCloseTo(70, 5);
    expect(series.factYs[1]).toBeCloseTo(72, 5);
    expect(series.factYs[2]).toBeNull();
    expect(series.factYs[3]).toBeNull();

    expect(series.draftYs[0]).toBeNull();
    expect(series.draftYs[1]).toBeCloseTo(72, 5); // bridge current_chain at as-of
    expect(series.draftYs[2]).toBeCloseTo(73, 5);
    expect(series.draftYs[3]).toBeCloseTo(74, 5);

    expect(series.upperYs[2]).toBeCloseTo(74.5, 5);
    expect(series.lowerYs[2]).toBeCloseTo(71.5, 5);
    expect(series.target).toBe(75);
  });
});
