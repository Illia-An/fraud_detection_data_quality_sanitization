import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from './api';
import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import {
  applyScenarioSurplusPass,
  getScenarioPack,
  SCENARIO_PACKS,
} from './scenarioPacks';

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 72,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 71 },
    { year: 2025, month: 5, score: 72 },
  ],
  projections: [
    {
      store_id: 1,
      months: [
        { year: 2025, month: 4, score: 60 },
        { year: 2025, month: 5, score: 62 },
      ],
    },
    {
      store_id: 2,
      months: [
        { year: 2025, month: 4, score: 70 },
        { year: 2025, month: 5, score: 72 },
      ],
    },
    {
      store_id: 3,
      months: [
        { year: 2025, month: 4, score: 80 },
        { year: 2025, month: 5, score: 82 },
      ],
    },
  ],
};

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 3,
  rows: [
    { store_id: 1, year: 2025, month: 4, five_percent: 55, survey_volume: 100 },
    { store_id: 2, year: 2025, month: 4, five_percent: 70, survey_volume: 100 },
    { store_id: 3, year: 2025, month: 4, five_percent: 88, survey_volume: 100 },
  ],
};

describe('scenarioPacks', () => {
  it('exposes the three v1 packs with expected surplus modes', () => {
    expect(SCENARIO_PACKS.map((p) => p.id)).toEqual([
      'close_gap',
      'rebalance',
      'steady_grind',
    ]);
    expect(getScenarioPack('close_gap').surplus?.clawbackDonors).toBe(false);
    expect(getScenarioPack('rebalance').surplus?.clawbackDonors).toBe(true);
    expect(getScenarioPack('steady_grind').surplus).toBeNull();
    expect(getScenarioPack('close_gap').params.priority_power).toBeGreaterThan(
      getScenarioPack('steady_grind').params.priority_power,
    );
  });

  it('close_gap surplus pass raises network (spend)', () => {
    const surplus = getScenarioPack('close_gap').surplus!;
    const { applied, result, plan: next } = applyScenarioSurplusPass(
      plan,
      panel,
      { year: 2025, month: 4 },
      surplus,
    );
    expect(applied).toBe(true);
    expect(result?.mode).toBe('spend');
    expect(next.final_chain).toBeGreaterThan(plan.final_chain - 1e-9);
  });

  it('rebalance surplus pass stays near zero-sum (clawback)', () => {
    const surplus = getScenarioPack('rebalance').surplus!;
    const { applied, result } = applyScenarioSurplusPass(
      plan,
      panel,
      { year: 2025, month: 4 },
      surplus,
    );
    expect(applied).toBe(true);
    expect(result?.mode).toBe('clawback');
    expect(Math.abs(result!.networkDeltaPp)).toBeLessThan(0.5);
  });
});
