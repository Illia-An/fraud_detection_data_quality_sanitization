import { describe, expect, it } from 'vitest';

import { buildPlanMonitoringInsights } from './planMonitoring';
import {
  directionAwareDeviation,
  momIsDeterioration,
  type DirectedPlan,
  type MetricScorePanel,
} from './metricScore';
import { redistributeSurplusToBehind } from './surplusRedistribute';

const plan: DirectedPlan = {
  direction: 'lower_is_better',
  unit: 'min',
  target: 3.5,
  current_chain: 4,
  required_change: 0.5,
  final_chain: 3.7,
  feasible: false,
  chain_trajectory: [
    { year: 2025, month: 12, score: 3.95 },
    { year: 2026, month: 1, score: 3.7 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 12, score: 4.2 },
        { year: 2026, month: 1, score: 4.0 },
      ],
    },
    {
      store_id: 20,
      months: [
        { year: 2025, month: 12, score: 3.7 },
        { year: 2026, month: 1, score: 3.4 },
      ],
    },
  ],
};

const panel: MetricScorePanel = {
  rows: [
    { store_id: 10, year: 2025, month: 11, tts: 4.0 },
    { store_id: 10, year: 2025, month: 12, tts: 4.4 },
    { store_id: 20, year: 2025, month: 12, tts: 3.5 },
  ],
};

describe('tts metric direction', () => {
  it('treats minutes above the plan as worse', () => {
    expect(directionAwareDeviation(4.4, 4.2, 'lower_is_better')).toBeCloseTo(-0.2);
    expect(directionAwareDeviation(3.5, 3.7, 'lower_is_better')).toBeCloseTo(0.2);
    expect(momIsDeterioration(0.2, 'lower_is_better')).toBe(true);
    expect(momIsDeterioration(-0.2, 'lower_is_better')).toBe(false);
    expect(momIsDeterioration(-0.2)).toBe(true);
  });

  it('classifies the slower store as behind', () => {
    const insights = buildPlanMonitoringInsights(plan, panel, { year: 2025, month: 12 }, 0.05);
    expect(insights.stores.find((row) => row.store_id === 10)?.signal).toBe('behind_plan');
    expect(insights.stores.find((row) => row.store_id === 20)?.signal).toBe('ahead_of_plan');
    expect(insights.chain.on_track).toBe(true);
  });

  it('spends surplus by lowering minutes on the slower store', () => {
    const insights = buildPlanMonitoringInsights(plan, panel, { year: 2025, month: 12 }, 0.05);
    const result = redistributeSurplusToBehind(plan, insights, {
      topDonors: 1,
      topReceivers: 1,
      harvestFraction: 0.5,
      clawbackDonors: false,
      floor: 0,
      ceiling: 30,
    });
    const slower = result.plan.projections.find((row) => row.store_id === 10);
    expect(result.receiverIds).toEqual([10]);
    expect(slower?.months[0].score).toBeLessThan(4.2);
    expect(result.plan.direction).toBe('lower_is_better');
  });
});
