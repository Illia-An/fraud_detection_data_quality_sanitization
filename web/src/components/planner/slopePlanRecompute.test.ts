import { describe, expect, it } from 'vitest';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import { buildNetworkCumulativeSlopeLayers } from './cumulativeSlopeLayers';
import type { DirectedPlan } from '../../schemas/metricScore';
import {
  applyDragPin,
  overlayDirectedPlanWithSlopePackage,
  overlayNetworkPlanPackage,
  recomputePinnedSlopePlan,
} from './slopePlanRecompute';

function sampleSim(): SimulationResponse {
  return {
    as_of: { year: 2026, month: 1 },
    planning_year: 2026,
    active_plan_version_id: null,
    network: {
      network_target: 75,
      network_mean_as_of: 64,
      projected_network_mean_eoy: 70,
      feasible: true,
      store_count: 2,
    },
    stores: [
      {
        store_id: 1,
        monthly_target: [],
        cumulative_planned: [],
        actual: [
          { year: 2025, month: 12, score: 60 },
          { year: 2026, month: 1, score: 62 },
        ],
        cumulative_actual: [
          { year: 2025, month: 12, score: 60 },
          { year: 2026, month: 1, score: 61 },
        ],
        simulation: [
          { year: 2026, month: 2, score: 63 },
          { year: 2026, month: 3, score: 64 },
        ],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 12, score: 60 },
          { year: 2026, month: 1, score: 61 },
          { year: 2026, month: 2, score: 62 },
          { year: 2026, month: 3, score: 62.5 },
        ],
        implied_target: 75,
        gap_to_mean: 0,
        slope: 0.5,
        unreachable: false,
        suggested_implied_target: null,
        capped: false,
      },
      {
        store_id: 2,
        monthly_target: [],
        cumulative_planned: [],
        actual: [
          { year: 2025, month: 12, score: 66 },
          { year: 2026, month: 1, score: 66 },
        ],
        cumulative_actual: [
          { year: 2025, month: 12, score: 66 },
          { year: 2026, month: 1, score: 66 },
        ],
        simulation: [
          { year: 2026, month: 2, score: 67 },
          { year: 2026, month: 3, score: 68 },
        ],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 12, score: 66 },
          { year: 2026, month: 1, score: 66 },
          { year: 2026, month: 2, score: 66.5 },
          { year: 2026, month: 3, score: 67 },
        ],
        implied_target: 75,
        gap_to_mean: 0,
        slope: 0.5,
        unreachable: false,
        suggested_implied_target: null,
        capped: false,
      },
    ],
    unreachable: [],
  };
}

describe('slopePlanRecompute', () => {
  it('overlay replaces network plan series atomically', () => {
    const layers = buildNetworkCumulativeSlopeLayers(sampleSim());
    const r = applyDragPin(layers, sampleSim(), [], 'cumulative', layers.cutover.factEndIndex + 2, 72);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const overlaid = overlayNetworkPlanPackage(layers, r.package);
    expect(overlaid.planCumYs).toEqual(r.package.planCumYs);
    expect(overlaid.planYs).toEqual(r.package.planYs);
    expect(r.package.byStore).not.toBeNull();
    expect(overlaid.simYs).toEqual(layers.simYs);
  });

  it('rejects invalid month at/before handoff', () => {
    const layers = buildNetworkCumulativeSlopeLayers(sampleSim());
    const r = applyDragPin(
      layers,
      sampleSim(),
      [],
      'monthly',
      layers.cutover.factEndIndex,
      80,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid_month');
  });

  it('network mode skips byStore; full mode allocates', () => {
    const sim = sampleSim();
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    const idx = layers.cutover.factEndIndex + 2;
    const net = recomputePinnedSlopePlan(layers, sim, [{ kind: 'cumulative', monthIndex: idx, value: 72 }], 'network');
    expect(net.ok).toBe(true);
    if (net.ok) expect(net.package.byStore).toBeNull();

    const full = recomputePinnedSlopePlan(layers, sim, [{ kind: 'cumulative', monthIndex: idx, value: 72 }], 'full');
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(full.package.byStore).not.toBeNull();
      expect(full.package.planYs).toEqual(net.ok ? net.package.planYs : null);
    }
  });

  it('overlayDirectedPlanWithSlopePackage patches plan-end from allocate', () => {
    const sim = sampleSim();
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    const idx = layers.cutover.factEndIndex + 2;
    const r = applyDragPin(layers, sim, [], 'cumulative', idx, 72);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const plan: DirectedPlan = {
      direction: 'higher_is_better',
      unit: '%',
      target: 75,
      current_chain: 64,
      required_change: 11,
      final_chain: 70,
      feasible: true,
      chain_trajectory: [
        { year: 2026, month: 2, score: 65 },
        { year: 2026, month: 12, score: 70 },
      ],
      projections: [
        {
          store_id: 1,
          months: [
            { year: 2026, month: 2, score: 63 },
            { year: 2026, month: 12, score: 70 },
          ],
        },
        {
          store_id: 2,
          months: [
            { year: 2026, month: 2, score: 67 },
            { year: 2026, month: 12, score: 70 },
          ],
        },
      ],
    };
    const overlaid = overlayDirectedPlanWithSlopePackage(plan, r.package, layers.labels);
    const decIdx = layers.labels.indexOf('2026-12');
    expect(decIdx).toBeGreaterThanOrEqual(0);
    expect(overlaid.projections[0]!.months[1]!.score).toBe(r.package.byStore!.get(1)!.planYs[decIdx]!);
    expect(overlaid.final_chain).toBe(r.package.planYs[decIdx]!);
  });
});
