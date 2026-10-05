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
  row_count: 3,
  rows: [
    { store_id: 10, year: 2025, month: 2, five_percent: 60, survey_volume: 90 },
    { store_id: 10, year: 2025, month: 3, five_percent: 64, survey_volume: 95 },
    { store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 100 },
    { store_id: 99, year: 2025, month: 2, five_percent: 90, survey_volume: 50 },
  ],
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
  it('extends fact history before plan start (Hero timeline grammar)', () => {
    const series = buildStoreHeroEvaluationSeries(plan, 10, panel, insights);
    expect(series).not.toBeNull();
    expect(series!.labels).toEqual(['2025-02', '2025-03', '2025-04', '2025-05']);
    expect(series!.actualYs).toEqual([60, 64, 66, null]);
    expect(series!.asOfLabel).toBe('2025-04');
    expect(series!.asOfIndex).toBe(2);
    expect(series!.deviation).toBe(-2);
    expect(series!.target).toBe(75);
    // Blue handoff at last purple, then May plan
    expect(series!.planYs[0]).toBeNull();
    expect(series!.planYs[1]).toBeNull();
    expect(series!.planYs[2]).toBeCloseTo(63.33, 2); // cumulative handoff
    expect(series!.planYs[3]).toBe(72);
  });

  it('continues store plan-cumulative from cumulative actual handoff', () => {
    const series = buildStoreHeroEvaluationSeries(plan, 10, panel, insights);
    // Purple: 60; (60+64)/2=62; (60+64+66)/3=63.33
    expect(series!.cumulativeYs[0]).toBeCloseTo(60, 2);
    expect(series!.cumulativeYs[1]).toBeCloseTo(62, 2);
    expect(series!.cumulativeYs[2]).toBeCloseTo(63.33, 2);
    expect(series!.cumulativeYs[3]).toBeNull();
    // Green from handoff: 63.33 → (60+64+66+72)/4 = 65.5
    expect(series!.planCumulativeYs[0]).toBeNull();
    expect(series!.planCumulativeYs[1]).toBeNull();
    expect(series!.planCumulativeYs[2]).toBeCloseTo(63.33, 2);
    expect(series!.planCumulativeYs[3]).toBeCloseTo(65.5, 2);
  });

  it('applies ephemeral draftLast to final plan month and plan-cumulative', () => {
    const series = buildStoreHeroEvaluationSeries(plan, 10, panel, insights, 70);
    expect(series!.planYs[3]).toBe(70);
    expect(series!.planCumulativeYs[2]).toBeCloseTo(63.33, 2);
    expect(series!.planCumulativeYs[3]).toBeCloseTo(65, 2); // (60+64+66+70)/4
  });
});
