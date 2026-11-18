import { describe, expect, it } from 'vitest';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import {
  buildAllocatedStorePlans,
  buildHistoryCumLinearPlan,
  buildInspectSlopeAlign,
  buildNetworkCumulativeSlopeLayers,
  buildRequiredFromDataStart,
  buildStoreCumulativeSlopeLayers,
  getStoreBoostGlance,
  inferSlopeSpineStart,
  lastSeriesValue,
  resolveSlopeCutover,
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

/** Planning 2026 with history from 2025-01 (matches Survey MVP spine). */
function crossYearSim(): SimulationResponse {
  return {
    as_of: { year: 2026, month: 1 },
    planning_year: 2026,
    active_plan_version_id: null,
    network: {
      network_target: 75,
      network_mean_as_of: 64,
      projected_network_mean_eoy: 67,
      feasible: false,
      store_count: 1,
    },
    stores: [
      {
        store_id: 10,
        monthly_target: [
          { year: 2026, month: 1, score: 65 },
          { year: 2026, month: 2, score: 66 },
          { year: 2026, month: 12, score: 77 },
        ],
        cumulative_planned: [
          { year: 2026, month: 1, score: 65 },
          { year: 2026, month: 2, score: 65.5 },
          { year: 2026, month: 12, score: 70 },
        ],
        actual: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 6, score: 62 },
          { year: 2025, month: 12, score: 63 },
          { year: 2026, month: 1, score: 64 },
        ],
        cumulative_actual: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 6, score: 61 },
          { year: 2025, month: 12, score: 62 },
          { year: 2026, month: 1, score: 62.5 },
        ],
        simulation: [{ year: 2026, month: 2, score: 65 }],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 1, score: 60 },
          { year: 2025, month: 6, score: 61 },
          { year: 2025, month: 12, score: 62 },
          { year: 2026, month: 1, score: 62.5 },
          { year: 2026, month: 2, score: 63 },
          { year: 2026, month: 12, score: 67 },
        ],
        implied_target: 75,
        gap_to_mean: 11,
        slope: 0.5,
        unreachable: true,
        suggested_implied_target: 72,
        capped: true,
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
    expect(layers.spineStart).toEqual({ year: 2025, month: 1 });
    expect(layers.actualYs[2]).toBeCloseTo(62);
    expect(layers.actualYs[3]).toBeNull();
    expect(layers.simYs[2]).toBeNull();
    expect(layers.simYs[3]).toBeCloseTo(63);
    // Plan mirrors history cum through handoff (Mar), then linear → target by Dec.
    expect(layers.planYs[0]).toBeCloseTo(60);
    expect(layers.planYs[2]).toBeCloseTo(62);
    expect(layers.planCumYs[2]).toBeCloseTo(layers.cumActualSimYs[2]!);
    expect(lastSeriesValue(layers.planCumYs)).toBeCloseTo(75);
    expect(layers.planYs[3]).not.toBeNull();
    // Required from data start lands on network target at Dec planning year.
    expect(lastSeriesValue(layers.requiredCumulativeYs)).toBeCloseTo(75);
    expect(layers.requiredMonthlyYs[2]).toBeCloseTo(62); // stitches last fact
    expect(layers.requiredMonthlyYs[3]).not.toBeNull();
  });

  it('buildRequiredFromDataStart uses spineStart not a −3 window', () => {
    const spine = [
      { year: 2025, month: 1 },
      { year: 2025, month: 2 },
      { year: 2025, month: 3 },
      { year: 2025, month: 4 },
    ];
    const actualYs = [60, 62, null, null];
    const pair = buildRequiredFromDataStart(
      spine,
      actualYs,
      { year: 2025, month: 1 },
      70,
      2025,
    );
    // Knowledge = Jan–Feb only; last fact Feb → required from Mar onward.
    expect(pair.requiredMonthlyYs[1]).toBeCloseTo(62);
    expect(pair.requiredMonthlyYs[2]).not.toBeNull();
    expect(lastSeriesValue(pair.requiredCumulativeYs)).toBeCloseTo(70);
  });

  it('extends spine from 2025 history through Dec of planning year', () => {
    const sim = crossYearSim();
    expect(inferSlopeSpineStart(sim)).toEqual({ year: 2025, month: 1 });
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    expect(layers.labels[0]).toBe('2025-01');
    expect(layers.labels[layers.labels.length - 1]).toBe('2026-12');
    expect(layers.labels).toHaveLength(24);
    expect(layers.asOfLabel).toBe('2026-01');
    // History months: Plan mirrors actual + history cum (continuous handoff).
    expect(layers.actualYs[0]).toBeCloseTo(60);
    expect(layers.planYs[0]).toBeCloseTo(60);
    expect(layers.planCumYs[0]).toBeCloseTo(layers.cumActualSimYs[0]!);
    expect(layers.cumActualSimYtdYs[0]).toBeNull();
    // Handoff Jan 2026: Plan cum = history cum (62.5), not YTD (64).
    const jan26 = layers.labels.indexOf('2026-01');
    expect(layers.planYs[jan26]).toBeCloseTo(64);
    expect(layers.cumActualSimYs[jan26]).toBeCloseTo(62.5);
    expect(layers.planCumYs[jan26]).toBeCloseTo(62.5);
    expect(layers.cumActualSimYtdYs[jan26]).toBeCloseTo(64);
    expect(lastSeriesValue(layers.planCumYs)).toBeCloseTo(75);
    expect(layers.planYs[jan26 + 1]).not.toBeNull();
    expect(layers.simYs[jan26]).toBeNull();
    expect(layers.simYs[jan26 + 1]).toBeCloseTo(65);
    expect(layers.cumActualSimYtdYs[jan26 + 1]).toBeCloseTo(64.5);
  });

  it('exposes boost glance gap and slope for Inspect', () => {
    const glance = getStoreBoostGlance(crossYearSim(), 10);
    expect(glance).toEqual({
      storeId: 10,
      gapToMean: 11,
      slope: 0.5,
      unreachable: true,
    });
    expect(getStoreBoostGlance(crossYearSim(), 999)).toBeNull();
  });

  it('builds store layers and surfaces unreachable', () => {
    const sim = sampleSim();
    sim.stores[0].unreachable = true;
    sim.stores[0].suggested_implied_target = 73;
    const layers = buildStoreCumulativeSlopeLayers(sim, 10);
    expect(layers).not.toBeNull();
    expect(layers!.unreachable).toBe(true);
    expect(layers!.suggestedImpliedTarget).toBe(73);
    expect(layers!.spineStart).toEqual({ year: 2025, month: 1 });
    // Zero-padded labels must match Jan–Sep (regression: bare `${year}-${month}` broke these).
    expect(layers!.labels[0]).toBe('2025-01');
    expect(layers!.planYs[0]).toBeCloseTo(60);
    expect(layers!.planYs[1]).toBeCloseTo(61);
    expect(layers!.planYs[2]).toBeCloseTo(62);
    expect(lastSeriesValue(layers!.planCumYs)).toBeCloseTo(75);
    expect(layers!.actualYs[0]).toBeCloseTo(60);
    expect(layers!.actualYs[2]).toBeCloseTo(62);
    expect(layers!.simYs[3]).toBeCloseTo(63);
    expect(buildStoreCumulativeSlopeLayers(sim, 999)).toBeNull();
  });

  it('maps store plan from chain allocation (single store = chain Plan)', () => {
    const sim = crossYearSim();
    const network = buildNetworkCumulativeSlopeLayers(sim);
    const layers = buildStoreCumulativeSlopeLayers(sim, 10);
    expect(layers).not.toBeNull();
    const jan26 = layers!.labels.indexOf('2026-01');
    const feb26 = layers!.labels.indexOf('2026-02');
    expect(jan26).toBeGreaterThanOrEqual(0);
    expect(layers!.planYs[jan26]).toBeCloseTo(64); // mirrors fact
    expect(layers!.planCumYs[jan26]).toBeCloseTo(62.5); // history cum handoff
    // One store → allocated monthly equals network monthly Plan.
    expect(layers!.planYs[feb26]).toBeCloseTo(network.planYs[feb26]!);
    expect(layers!.planCumYs[feb26]).toBeCloseTo(network.planCumYs[feb26]!);
    expect(lastSeriesValue(layers!.planCumYs)).toBeCloseTo(75);
    expect(layers!.target).toBe(75);
    expect(layers!.actualYs[jan26]).toBeCloseTo(64);
    expect(layers!.simYs[feb26]).toBeCloseTo(65);
  });

  it('allocates two stores so equal-weight mean tracks network Plan', () => {
    const sim = sampleSim();
    sim.network.store_count = 2;
    sim.stores = [
      { ...sim.stores[0]!, store_id: 1 },
      {
        ...sim.stores[0]!,
        store_id: 2,
        actual: [
          { year: 2025, month: 1, score: 50 },
          { year: 2025, month: 2, score: 52 },
          { year: 2025, month: 3, score: 54 },
        ],
        cumulative_actual: [
          { year: 2025, month: 1, score: 50 },
          { year: 2025, month: 2, score: 51 },
          { year: 2025, month: 3, score: 52 },
        ],
        simulation: [{ year: 2025, month: 4, score: 55 }],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 1, score: 50 },
          { year: 2025, month: 2, score: 51 },
          { year: 2025, month: 3, score: 52 },
          { year: 2025, month: 4, score: 52.75 },
        ],
      },
    ];
    const network = buildNetworkCumulativeSlopeLayers(sim);
    const allocated = buildAllocatedStorePlans(sim);
    const apr = network.labels.indexOf('2025-04');
    expect(apr).toBeGreaterThanOrEqual(0);
    const a = allocated.byStore.get(1)!.planYs[apr]!;
    const b = allocated.byStore.get(2)!.planYs[apr]!;
    expect((a + b) / 2).toBeCloseTo(network.planYs[apr]!, 1);
    // Behind store (2) should receive a larger lift from Mar→Apr than store 1.
    const a0 = allocated.byStore.get(1)!.planYs[apr - 1]!;
    const b0 = allocated.byStore.get(2)!.planYs[apr - 1]!;
    expect(b - b0).toBeGreaterThan(a - a0);
  });

  it('resolveSlopeCutover puts the line at the first month after last fact', () => {
    const labels = ['2025-11', '2025-12', '2026-01', '2026-02'];
    const actualYs = [60, 58, null, null];
    const cut = resolveSlopeCutover(labels, actualYs, '2026-01');
    expect(cut.factEndLabel).toBe('2025-12');
    expect(cut.forecastStartLabel).toBe('2026-01');
    expect(cut.lineLabel).toBe('2026-01');
    expect(cut.declaredAsOfLabel).toBe('2026-01');
  });

  it('store layers expose cutover from last plotted actual', () => {
    const layers = buildStoreCumulativeSlopeLayers(crossYearSim(), 10);
    expect(layers).not.toBeNull();
    // crossYearSim as_of 2026-01 with Jan actual → fact ends at Jan, forecast from Feb.
    expect(layers!.cutover.factEndLabel).toBe('2026-01');
    expect(layers!.cutover.forecastStartLabel).toBe('2026-02');
    expect(layers!.cutover.lineLabel).toBe('2026-02');
  });

  it('buildInspectSlopeAlign uses last fact month and EOY cumulative ends', () => {
    const layers = buildStoreCumulativeSlopeLayers(crossYearSim(), 10);
    expect(layers).not.toBeNull();
    const align = buildInspectSlopeAlign(layers!);
    expect(align.factMonth).toBe('2026-01');
    expect(align.fact).toBeCloseTo(64);
    expect(align.planAtFact).toBeCloseTo(64); // Plan mirrors fact monthly at handoff
    expect(align.declaredAsOfLabel).toBe('2026-01');
    expect(align.eoyPlanCumulative).toBeCloseTo(75, 0);
    expect(align.planEndMonthly).not.toBeNull();
    expect(align.eoyForecastCumulative).not.toBeNull();
  });

  it('buildHistoryCumLinearPlan starts from history cum and ends at target', () => {
    const spine = [
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ];
    const actualYs = [60, 62, 64, null];
    // History cum: 60, 61, 62
    const historyCumYs = [60, 61, 62, null];
    const cutover = resolveSlopeCutover(
      ['2025-11', '2025-12', '2026-01', '2026-02'],
      actualYs,
      '2026-01',
    );
    const { planYs, planCumYs } = buildHistoryCumLinearPlan(
      spine,
      2026,
      actualYs,
      historyCumYs,
      cutover,
      75,
      60,
    );
    expect(planCumYs[2]).toBeCloseTo(62); // handoff = history cum, not YTD-only
    expect(planYs[2]).toBeCloseTo(64);
    expect(planCumYs[3]).toBeCloseTo(75);
    expect(planYs[3]).not.toBeNull();
  });
});
