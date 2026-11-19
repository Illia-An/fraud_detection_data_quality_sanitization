import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import { buildNetworkCumulativeSlopeLayers } from './cumulativeSlopeLayers';
import { useSlopePlanDraft } from './useSlopePlanDraft';

function sampleSim(target = 75): SimulationResponse {
  return {
    as_of: { year: 2026, month: 1 },
    planning_year: 2026,
    active_plan_version_id: null,
    network: {
      network_target: target,
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
        simulation: [{ year: 2026, month: 2, score: 63 }],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 12, score: 60 },
          { year: 2026, month: 1, score: 61 },
          { year: 2026, month: 2, score: 62 },
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
        simulation: [{ year: 2026, month: 2, score: 67 }],
        cumulative_actual_or_simulation: [
          { year: 2025, month: 12, score: 66 },
          { year: 2026, month: 1, score: 66 },
          { year: 2026, month: 2, score: 66.5 },
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

describe('useSlopePlanDraft', () => {
  it('commits a feasible pin and marks dirty; reset clears', () => {
    const sim = sampleSim();
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    const monthIndex = layers.cutover.factEndIndex + 2;
    const { result } = renderHook(() => useSlopePlanDraft(layers, sim));

    expect(result.current.dirty).toBe(false);
    act(() => {
      result.current.endDrag('cumulative', monthIndex, 72);
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.lastGood?.pins).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.displayLayers?.planCumYs).not.toEqual(layers.planCumYs);

    act(() => {
      result.current.resetPins();
    });
    expect(result.current.dirty).toBe(false);
    expect(result.current.lastGood).toBeNull();
    expect(result.current.displayLayers?.planCumYs).toEqual(layers.planCumYs);
  });

  it('rejects infeasible edit and keeps lastGood plan on display', () => {
    const sim = sampleSim();
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    const monthIndex = layers.cutover.factEndIndex + 1;
    const { result } = renderHook(() => useSlopePlanDraft(layers, sim));

    act(() => {
      result.current.endDrag('cumulative', monthIndex, 72);
    });
    const goodCum = result.current.displayLayers?.planCumYs;
    expect(result.current.dirty).toBe(true);

    act(() => {
      // Pin on handoff month → invalid_month
      result.current.endDrag('cumulative', layers.cutover.factEndIndex, 90);
    });
    expect(result.current.error?.code).toBe('invalid_month');
    expect(result.current.displayLayers?.planCumYs).toEqual(goodCum);
    expect(result.current.dirty).toBe(true);
  });

  it('previewDrag is network-only; endDrag allocates byStore', async () => {
    const sim = sampleSim();
    const layers = buildNetworkCumulativeSlopeLayers(sim);
    const monthIndex = layers.cutover.factEndIndex + 2;
    const { result } = renderHook(() => useSlopePlanDraft(layers, sim));

    act(() => {
      result.current.previewDrag('cumulative', monthIndex, 72);
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
    expect(result.current.status).toBe('previewing');
    expect(result.current.byStore).toBeNull();
    expect(result.current.preview?.byStore).toBeNull();
    expect(result.current.displayLayers?.planCumYs).not.toEqual(layers.planCumYs);

    act(() => {
      result.current.endDrag('cumulative', monthIndex, 72);
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.byStore).not.toBeNull();
    expect(result.current.lastGood?.byStore?.size).toBe(2);
  });

  it('resets when simulation context (target) changes', () => {
    const sim75 = sampleSim(75);
    const layers75 = buildNetworkCumulativeSlopeLayers(sim75);
    const { result, rerender } = renderHook(
      ({ layers, sim }) => useSlopePlanDraft(layers, sim),
      { initialProps: { layers: layers75, sim: sim75 } },
    );
    const monthIndex = layers75.cutover.factEndIndex + 2;
    act(() => {
      result.current.endDrag('cumulative', monthIndex, 72);
    });
    expect(result.current.dirty).toBe(true);

    const sim80 = sampleSim(80);
    const layers80 = buildNetworkCumulativeSlopeLayers(sim80);
    rerender({ layers: layers80, sim: sim80 });
    expect(result.current.dirty).toBe(false);
    expect(result.current.lastGood).toBeNull();
  });
});
