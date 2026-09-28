import { describe, expect, it } from 'vitest';

import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import { defaultPipelineConfig } from './api';
import {
  buildChainMonthCompares,
  buildPlanMonitoringInsights,
  defaultAsOf,
} from './planMonitoring';

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
    { year: 2025, month: 5, score: 72.5 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 4, score: 68 },
        { year: 2025, month: 5, score: 70 },
      ],
    },
    {
      store_id: 20,
      months: [
        { year: 2025, month: 4, score: 74 },
        { year: 2025, month: 5, score: 75 },
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
  row_count: 2,
  rows: [
    { store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 50 },
    { store_id: 20, year: 2025, month: 4, five_percent: 76, survey_volume: 50 },
  ],
};

describe('planMonitoring', () => {
  it('fills actual for months present in panel', () => {
    const months = buildChainMonthCompares(plan, panel);
    expect(months[0].actual).toBe(71);
    expect(months[0].delta).toBe(0);
    expect(months[1].actual).toBeNull();
  });

  it('defaults as-of to last month with actuals', () => {
    const asOf = defaultAsOf(plan, panel);
    expect(asOf.year).toBe(2025);
    expect(asOf.month).toBe(4);
  });

  it('classifies stores ahead/behind/on at as-of', () => {
    const insights = buildPlanMonitoringInsights(plan, panel, { year: 2025, month: 4 }, 1);
    expect(insights.summary.behind).toBe(1);
    expect(insights.summary.ahead).toBe(1);
    expect(insights.stores.find((s) => s.store_id === 10)?.signal).toBe('behind_plan');
    expect(insights.stores.find((s) => s.store_id === 20)?.signal).toBe('ahead_of_plan');
  });
});
