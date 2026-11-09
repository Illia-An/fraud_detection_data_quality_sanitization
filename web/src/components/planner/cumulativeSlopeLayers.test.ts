import { describe, expect, it } from 'vitest';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import {
  buildNetworkCumulativeSlopeLayers,
  buildStoreCumulativeSlopeLayers,
} from './cumulativeSlopeLayers';

function sampleSim(): SimulationResponse {
  return {
    as_of: { year: 2025, month: 3 },
    planning_year: 2025,
    active_plan_version_id: null,
    network: {
      network_target: 75,
      network_mean_as_of: 70,
      projected_network_mean_eoy: 72,
      feasible: false,
      store_count: 1,
    },
    stores: [
      {
        store_id: 10,
        monthly_target: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 2, score: 61 },
          { year: 2025, month: 3, score: 62 },
          { year: 2025, month: 4, score: 63 },
        ],
        cumulative_planned: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 2, score: 60.5 },
          { year: 2025, month: 3, score: 61 },
          { year: 2025, month: 4, score: 61.5 },
        ],
        actual: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 2, score: 61 },
          { year: 2025, month: 3, score: 62 },
        ],
        cumulative_actual: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 2, score: 60.5 },
          { year: 2025, month: 3, score: 61 },
        ],
        simulation: [{ year: 2025, month: 4, score: 63 }],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 2, score: 60.5 },
          { year: 2025, month: 3, score: 61 },
          { year: 2025, month: 4, score: 61.5 },
        ],
        implied_target: 75,
        gap_to_mean: 8,
        slope: 1,
        unreachable: false,
        suggested_implied_target: null,
        capped: false,
      },
    ],
    unreachable: [],
  };
}

describe('cumulativeSlopeLayers', () => {
  it('builds network layers with null actual after as-of and null sim through as-of', () => {
    const layers = buildNetworkCumulativeSlopeLayers(sampleSim());
    expect(layers.labels).toHaveLength(12);
    expect(layers.asOfLabel).toBe('2025-03');
    expect(layers.actualYs[2]).toBeCloseTo(62);
    expect(layers.actualYs[3]).toBeNull();
    expect(layers.simYs[2]).toBeNull();
    expect(layers.simYs[3]).toBeCloseTo(63);
    expect(layers.planYs[0]).toBeCloseTo(60);
  });

  it('builds store layers and surfaces unreachable', () => {
    const sim = sampleSim();
    sim.stores[0].unreachable = true;
    sim.stores[0].suggested_implied_target = 73;
    const layers = buildStoreCumulativeSlopeLayers(sim, 10);
    expect(layers).not.toBeNull();
    expect(layers!.unreachable).toBe(true);
    expect(layers!.suggestedImpliedTarget).toBe(73);
    expect(buildStoreCumulativeSlopeLayers(sim, 999)).toBeNull();
  });
});
