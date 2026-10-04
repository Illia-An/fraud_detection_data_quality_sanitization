import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { buildStoreHeroEvaluationSeries } from './storeHeroEvaluationSeries';

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 71 },
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 4, score: 68 },
        { year: 2025, month: 5, score: 72 },
      ],
    },
  ],
};

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 4,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 100 }],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 66, on_track: false },
  months: [],
  stores: [
    {
      store_id: 10,
      signal: 'behind_plan',
      planned: 68,
      actual: 66,
      deviation: -2,
    },
  ],
  summary: { ahead: 0, on_plan: 0, behind: 1, insufficient: 0 },
};

describe('buildStoreHeroEvaluationSeries', () => {
  it('aligns actual, plan, and chain with as-of', () => {
    const series = buildStoreHeroEvaluationSeries(plan, 10, panel, insights);
    expect(series).not.toBeNull();
    expect(series!.labels).toEqual(['2025-04', '2025-05']);
    expect(series!.actualYs[0]).toBe(66);
    expect(series!.planYs[0]).toBe(68);
    expect(series!.planYs[1]).toBe(72);
    expect(series!.chainYs[0]).toBe(71);
    expect(series!.asOfLabel).toBe('2025-04');
    expect(series!.deviation).toBe(-2);
  });

  it('applies ephemeral draftLast to final plan month', () => {
    const series = buildStoreHeroEvaluationSeries(plan, 10, panel, insights, 70);
    expect(series!.planYs[1]).toBe(70);
  });
});
