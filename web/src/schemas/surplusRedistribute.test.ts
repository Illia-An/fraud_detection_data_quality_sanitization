import { describe, expect, it } from 'vitest';

import type { FivePercentPlan } from './plan';
import type { PlanMonitoringInsights } from './planMonitoring';
import {
  recomputeChainFromProjections,
  redistributeSurplusToBehind,
} from './surplusRedistribute';

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 80,
  current_chain: 70,
  required_change: 10,
  final_chain: 72,
  feasible: false,
  chain_trajectory: [
    { year: 2025, month: 4, score: 70 },
    { year: 2025, month: 5, score: 71 },
    { year: 2025, month: 6, score: 72 },
  ],
  projections: [
    {
      store_id: 1,
      months: [
        { year: 2025, month: 4, score: 60 },
        { year: 2025, month: 5, score: 61 },
        { year: 2025, month: 6, score: 62 },
      ],
    },
    {
      store_id: 2,
      months: [
        { year: 2025, month: 4, score: 70 },
        { year: 2025, month: 5, score: 71 },
        { year: 2025, month: 6, score: 72 },
      ],
    },
    {
      store_id: 3,
      months: [
        { year: 2025, month: 4, score: 80 },
        { year: 2025, month: 5, score: 81 },
        { year: 2025, month: 6, score: 82 },
      ],
    },
  ],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 70, actual: 70, on_track: true },
  summary: { ahead: 1, on_plan: 1, behind: 1, insufficient: 0 },
  stores: [
    {
      store_id: 1,
      signal: 'behind_plan',
      planned: 60,
      actual: 50,
      deviation: -10,
    },
    {
      store_id: 2,
      signal: 'on_plan',
      planned: 70,
      actual: 70,
      deviation: 0,
    },
    {
      store_id: 3,
      signal: 'ahead_of_plan',
      planned: 80,
      actual: 90,
      deviation: 10,
    },
  ],
  months: [],
};

describe('surplusRedistribute', () => {
  it('recomputes equal-mean chain from projections', () => {
    const next = recomputeChainFromProjections(structuredClone(plan));
    expect(next.chain_trajectory[0].score).toBeCloseTo((60 + 70 + 80) / 3, 5);
    expect(next.final_chain).toBeCloseTo((62 + 72 + 82) / 3, 5);
  });

  it('spend mode: raises behind from ahead surplus without clawback (network rises)', () => {
    const result = redistributeSurplusToBehind(plan, insights, {
      topDonors: 1,
      topReceivers: 1,
      harvestFraction: 0.5,
      clawbackDonors: false,
    });
    // pool = 10 * 0.5 = 5 → store 1 as-of 60 → 65
    expect(result.poolPp).toBeCloseTo(5, 5);
    expect(result.mode).toBe('spend');
    expect(result.donorIds).toEqual([3]);
    expect(result.receiverIds).toEqual([1]);

    const behind = result.plan.projections.find((p) => p.store_id === 1)!;
    expect(behind.months[0].score).toBeCloseTo(65, 5);
    expect(behind.months[2].score).toBeCloseTo(67, 5);

    const ahead = result.plan.projections.find((p) => p.store_id === 3)!;
    expect(ahead.months[0].score).toBeCloseTo(80, 5);

    expect(result.networkDeltaPp).toBeGreaterThan(0.5);
  });

  it('clawback mode: lowers ahead and raises behind (near zero-sum)', () => {
    const result = redistributeSurplusToBehind(plan, insights, {
      topDonors: 1,
      topReceivers: 1,
      harvestFraction: 0.5,
      clawbackDonors: true,
    });
    expect(result.mode).toBe('clawback');
    const behind = result.plan.projections.find((p) => p.store_id === 1)!;
    const ahead = result.plan.projections.find((p) => p.store_id === 3)!;
    expect(behind.months[0].score).toBeCloseTo(65, 5);
    expect(ahead.months[0].score).toBeCloseTo(75, 5);
    expect(Math.abs(result.networkDeltaPp)).toBeLessThan(0.2);
  });

  it('no-ops when no ahead/behind', () => {
    const empty: PlanMonitoringInsights = {
      ...insights,
      stores: [
        {
          store_id: 2,
          signal: 'on_plan',
          planned: 70,
          actual: 70,
          deviation: 0,
        },
      ],
      summary: { ahead: 0, on_plan: 1, behind: 0, insufficient: 0 },
    };
    const result = redistributeSurplusToBehind(plan, empty);
    expect(result.poolPp).toBe(0);
    expect(result.distributedPp).toBe(0);
    expect(result.networkDeltaPp).toBe(0);
  });
});
