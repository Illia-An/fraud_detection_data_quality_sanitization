import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import {
  buildHeroEvaluationSeries,
  cumulativeMeanSeries,
} from './heroEvaluationSeries';

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

describe('cumulativeMeanSeries', () => {
  it('computes running mean of monthly scores to hundredths', () => {
    expect(cumulativeMeanSeries([70, 80, 100])).toEqual([70, 75, 83.33]);
    expect(cumulativeMeanSeries([70, null, 80])).toEqual([70, null, 75]);
  });
});

describe('buildHeroEvaluationSeries', () => {
  it('puts cleansed fact left of as-of and draft forecast from as-of onward', () => {
    const series = buildHeroEvaluationSeries(draft, panel, { year: 2025, month: 3 }, 1.5);

    expect(series.asOfLabel).toBe('2025-03');
    expect(series.labels).toEqual(['2025-02', '2025-03', '2025-04', '2025-05']);
    // Feb network avg (68+72)/2 = 70; Mar (70+74)/2 = 72
    expect(series.factYs[0]).toBeCloseTo(70, 2);
    expect(series.factYs[1]).toBeCloseTo(72, 2);
    expect(series.factYs[2]).toBeNull();
    expect(series.factYs[3]).toBeNull();

    // Cumulative: 70; (70+72)/2 = 71
    expect(series.cumulativeYs[0]).toBeCloseTo(70, 2);
    expect(series.cumulativeYs[1]).toBeCloseTo(71, 2);
    expect(series.cumulativeYs[2]).toBeNull();
    expect(series.cumulativeYs[3]).toBeNull();

    // Green continues purple: handoff 71; then (70+72+73)/3; (70+72+73+74)/4
    expect(series.planCumulativeYs[0]).toBeNull();
    expect(series.planCumulativeYs[1]).toBeCloseTo(71, 2);
    expect(series.planCumulativeYs[2]).toBeCloseTo(71.67, 2);
    expect(series.planCumulativeYs[3]).toBeCloseTo(72.25, 2);

    expect(series.draftYs[0]).toBeNull();
    expect(series.draftYs[1]).toBeCloseTo(71, 5); // handoff = cumulative
    expect(series.draftYs[2]).toBeCloseTo(73, 5);
    expect(series.draftYs[3]).toBeCloseTo(74, 5);

    expect(series.upperYs[2]).toBeCloseTo(74.5, 5);
    expect(series.lowerYs[2]).toBeCloseTo(71.5, 5);
    expect(series.target).toBe(75);
  });

  it('anchors draft and plan-cumulative to purple when as-of is the first trajectory month', () => {
    const series = buildHeroEvaluationSeries(draft, panel, { year: 2025, month: 4 }, 1.5);

    expect(series.labels).toEqual(['2025-02', '2025-03', '2025-04', '2025-05']);
    expect(series.factYs[1]).toBeCloseTo(72, 2);
    expect(series.cumulativeYs[1]).toBeCloseTo(71, 2);
    expect(series.draftYs[0]).toBeNull();
    expect(series.draftYs[1]).toBeCloseTo(71, 5); // blue starts on purple
    expect(series.draftYs[2]).toBeCloseTo(73, 5);
    expect(series.draftYs[3]).toBeCloseTo(74, 5);
    expect(series.planCumulativeYs[0]).toBeNull();
    expect(series.planCumulativeYs[1]).toBeCloseTo(71, 2); // green starts on purple
    expect(series.planCumulativeYs[2]).toBeCloseTo(71.67, 2);
    expect(series.planCumulativeYs[3]).toBeCloseTo(72.25, 2);
  });
});
