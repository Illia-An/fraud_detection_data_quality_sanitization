/** Build Plotly-ready Plan / Actual / Simulation series from SimulationResponse. */

import type { SimulationResponse } from '../../schemas/cumulativePlan';

export interface CumulativeSlopeNetworkLayers {
  labels: string[];
  /** Frozen / computed monthly targets (network equal-mean). */
  planYs: (number | null)[];
  /** Cumulative planned (network). */
  planCumYs: (number | null)[];
  /** Actual monthly (network equal-mean of store actuals; null after as-of). */
  actualYs: (number | null)[];
  /** Simulation monthly after as-of. */
  simYs: (number | null)[];
  /** Continuous cumulative actual∥sim. */
  cumActualSimYs: (number | null)[];
  target: number;
  asOfLabel: string;
  planningYear: number;
}

function ymLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function meanAt(
  stores: SimulationResponse['stores'],
  pick: (s: SimulationResponse['stores'][number]) => { year: number; month: number; score: number }[],
  year: number,
  month: number,
): number | null {
  const vals: number[] = [];
  for (const store of stores) {
    const hit = pick(store).find((m) => m.year === year && m.month === month);
    if (hit != null) {
      vals.push(hit.score);
    }
  }
  if (vals.length === 0) {
    return null;
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Network-level layers for Hero (equal-weight across stores). */
export function buildNetworkCumulativeSlopeLayers(
  sim: SimulationResponse,
): CumulativeSlopeNetworkLayers {
  const labels: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    labels.push(ymLabel(sim.planning_year, month));
  }
  const asOfLabel = ymLabel(sim.as_of.year, sim.as_of.month);
  const asOfIdx =
    sim.as_of.year === sim.planning_year ? sim.as_of.month - 1 : labels.indexOf(asOfLabel);

  const planYs = labels.map((_, i) => {
    const month = i + 1;
    return meanAt(sim.stores, (s) => s.monthly_target, sim.planning_year, month);
  });
  const planCumYs = labels.map((_, i) => {
    const month = i + 1;
    return meanAt(sim.stores, (s) => s.cumulative_planned, sim.planning_year, month);
  });
  const actualYs = labels.map((_, i) => {
    const month = i + 1;
    if (asOfIdx >= 0 && i > asOfIdx) {
      return null;
    }
    return meanAt(sim.stores, (s) => s.actual, sim.planning_year, month);
  });
  const simYs = labels.map((_, i) => {
    const month = i + 1;
    if (asOfIdx >= 0 && i <= asOfIdx) {
      return null;
    }
    return meanAt(sim.stores, (s) => s.simulation, sim.planning_year, month);
  });
  const cumActualSimYs = labels.map((_, i) => {
    const month = i + 1;
    return meanAt(
      sim.stores,
      (s) => s.cumulative_actual_or_simulation,
      sim.planning_year,
      month,
    );
  });

  return {
    labels,
    planYs,
    planCumYs,
    actualYs,
    simYs,
    cumActualSimYs,
    target: sim.network.network_target,
    asOfLabel,
    planningYear: sim.planning_year,
  };
}

export interface CumulativeSlopeStoreLayers {
  labels: string[];
  planYs: (number | null)[];
  planCumYs: (number | null)[];
  actualYs: (number | null)[];
  simYs: (number | null)[];
  cumActualSimYs: (number | null)[];
  target: number;
  asOfLabel: string;
  unreachable: boolean;
  suggestedImpliedTarget: number | null;
}

export function buildStoreCumulativeSlopeLayers(
  sim: SimulationResponse,
  storeId: number,
): CumulativeSlopeStoreLayers | null {
  const store = sim.stores.find((s) => s.store_id === storeId);
  if (!store) {
    return null;
  }
  const labels: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    labels.push(ymLabel(sim.planning_year, month));
  }
  const asOfLabel = ymLabel(sim.as_of.year, sim.as_of.month);
  const scoreMap = (rows: { year: number; month: number; score: number }[]) => {
    const m = new Map(rows.map((r) => [`${r.year}-${r.month}`, r.score]));
    return labels.map((lab) => m.get(lab) ?? null);
  };
  const asOfIdx = labels.indexOf(asOfLabel);
  const actualRaw = scoreMap(store.actual);
  const simRaw = scoreMap(store.simulation);
  return {
    labels,
    planYs: scoreMap(store.monthly_target),
    planCumYs: scoreMap(store.cumulative_planned),
    actualYs: actualRaw.map((v, i) => (asOfIdx >= 0 && i > asOfIdx ? null : v)),
    simYs: simRaw.map((v, i) => (asOfIdx >= 0 && i <= asOfIdx ? null : v)),
    cumActualSimYs: scoreMap(store.cumulative_actual_or_simulation),
    target: sim.network.network_target,
    asOfLabel,
    unreachable: store.unreachable,
    suggestedImpliedTarget: store.suggested_implied_target,
  };
}
