/**
 * Build recompute inputs from Slope layers + simulation; overlay packages onto layers/plans.
 */

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import type { DirectedPlan } from '../../schemas/metricScore';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import {
  inferSlopeSpineStart,
  monthSpan,
  scoreAt,
  ymLabel,
} from './cumulativeSlopeLayers';
import type { YearMonth } from './chainStoreAllocate';
import type {
  AllocateGateContext,
  PlanPin,
  PlanPinKind,
  SlopePlanPackage,
} from './planTrajectoryPins';
import { recomputeSlopePlan, replacePin, type TrajectoryResult } from './planTrajectoryPins';

export function overlayNetworkPlanPackage(
  layers: CumulativeSlopePlotLayers,
  pkg: SlopePlanPackage,
): CumulativeSlopePlotLayers {
  return {
    ...layers,
    planYs: pkg.planYs,
    planCumYs: pkg.planCumYs,
  };
}

export interface SlopeStoreAllocateInputs {
  storeIds: number[];
  spine: YearMonth[];
  storeActualYs: Map<number, (number | null)[]>;
  storeHistoryCumYs: Map<number, (number | null)[]>;
  entryScores: Map<number, number>;
  handoffIdx: number;
  handoffCum: number;
  handoffCount: number;
  horizonEndIdx: number;
}

/** Build allocate inputs once — does NOT run store allocation. */
export function buildSlopeStoreAllocateInputs(
  layers: CumulativeSlopePlotLayers,
  sim: SimulationResponse,
): SlopeStoreAllocateInputs | null {
  const handoffIdx = layers.cutover.factEndIndex;
  if (handoffIdx < 0) return null;
  const handoffCum = layers.cumActualSimYs[handoffIdx];
  if (handoffCum == null || !Number.isFinite(handoffCum)) return null;

  let handoffCount = 0;
  for (let i = 0; i <= handoffIdx; i += 1) {
    if (layers.actualYs[i] != null) handoffCount += 1;
  }
  if (handoffCount < 1) handoffCount = 1;

  const spineStart = inferSlopeSpineStart(sim);
  const spine = monthSpan(spineStart, { year: sim.planning_year, month: 12 });
  let horizonEndIdx = layers.labels.length - 1;
  for (let i = layers.labels.length - 1; i >= 0; i -= 1) {
    if (layers.labels[i]!.startsWith(`${sim.planning_year}-`)) {
      horizonEndIdx = i;
      break;
    }
  }

  const asOfIdx = layers.labels.indexOf(layers.asOfLabel);
  const storeIds = sim.stores.map((s) => s.store_id);
  const storeActualYs = new Map<number, (number | null)[]>();
  const storeHistoryCumYs = new Map<number, (number | null)[]>();
  const entryScores = new Map<number, number>();
  for (const s of sim.stores) {
    const actual = spine.map((ym, i) => {
      if (asOfIdx >= 0 && i > asOfIdx) return null;
      return scoreAt(s.actual, ym.year, ym.month);
    });
    storeActualYs.set(s.store_id, actual);
    storeHistoryCumYs.set(
      s.store_id,
      spine.map((ym) => scoreAt(s.cumulative_actual_or_simulation, ym.year, ym.month)),
    );
    const asOfScore =
      scoreAt(s.actual, sim.as_of.year, sim.as_of.month) ??
      [...actual].reverse().find((v) => v != null) ??
      sim.network.network_mean_as_of;
    entryScores.set(s.store_id, asOfScore);
  }

  return {
    storeIds,
    spine,
    storeActualYs,
    storeHistoryCumYs,
    entryScores,
    handoffIdx,
    handoffCum,
    handoffCount,
    horizonEndIdx,
  };
}

function allocateContextFromInputs(
  inputs: SlopeStoreAllocateInputs,
  planningYear: number,
): AllocateGateContext {
  return {
    storeIds: inputs.storeIds,
    spine: inputs.spine,
    planningYear,
    chainPlanYs: [],
    storeActualYs: inputs.storeActualYs,
    entryScores: inputs.entryScores,
    storeHistoryCumYs: inputs.storeHistoryCumYs,
    opts: { floor: 0, ceiling: 100 },
  };
}

export type RecomputeMode = 'network' | 'full';

/**
 * @param mode `network` — trajectory only (fast preview). `full` — + allocate gate.
 */
export function recomputePinnedSlopePlan(
  layers: CumulativeSlopePlotLayers,
  sim: SimulationResponse,
  pins: readonly PlanPin[],
  mode: RecomputeMode = 'full',
  cachedInputs?: SlopeStoreAllocateInputs | null,
): TrajectoryResult {
  const inputs = cachedInputs ?? buildSlopeStoreAllocateInputs(layers, sim);
  if (!inputs) {
    return {
      ok: false,
      error: { code: 'empty_horizon', reason: 'No fact handoff to start plan from' },
    };
  }

  return recomputeSlopePlan({
    handoffIdx: inputs.handoffIdx,
    handoffCum: inputs.handoffCum,
    handoffCount: inputs.handoffCount,
    horizonEndIdx: inputs.horizonEndIdx,
    target: layers.target,
    pins: [...pins],
    spineLength: layers.labels.length,
    factMonthlyThroughHandoff: layers.actualYs,
    factCumThroughHandoff: layers.cumActualSimYs,
    floor: 0,
    ceiling: 100,
    allocate:
      mode === 'full'
        ? allocateContextFromInputs(inputs, sim.planning_year)
        : undefined,
  });
}

export function applyDragPin(
  layers: CumulativeSlopePlotLayers,
  sim: SimulationResponse,
  currentPins: readonly PlanPin[],
  kind: PlanPinKind,
  monthIndex: number,
  value: number,
  mode: RecomputeMode = 'full',
  cachedInputs?: SlopeStoreAllocateInputs | null,
): TrajectoryResult {
  const pins = replacePin(currentPins, { kind, monthIndex, value });
  return recomputePinnedSlopePlan(layers, sim, pins, mode, cachedInputs);
}

/** Stable key so draft resets when simulation context changes. */
export function slopePlanContextKey(sim: SimulationResponse | null): string {
  if (!sim) return '';
  return [
    sim.as_of.year,
    sim.as_of.month,
    sim.planning_year,
    sim.network.network_target,
    sim.stores.length,
    ymLabel(sim.as_of.year, sim.as_of.month),
  ].join('|');
}

export function parseYmLabel(label: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Overlay Slope allocate package onto a DirectedPlan so At-risk / monitoring
 * use the same store monthlies as charts + Inspect.
 */
export function overlayDirectedPlanWithSlopePackage<T extends DirectedPlan>(
  plan: T,
  pkg: SlopePlanPackage,
  labels: string[],
): T {
  if (!pkg.byStore || pkg.byStore.size === 0) {
    return plan;
  }

  const indexOf = (year: number, month: number): number => {
    for (let i = 0; i < labels.length; i += 1) {
      const ym = parseYmLabel(labels[i]!);
      if (ym && ym.year === year && ym.month === month) return i;
    }
    return -1;
  };

  const chain_trajectory = plan.chain_trajectory.map((pt) => {
    const idx = indexOf(pt.year, pt.month);
    const score = idx >= 0 ? pkg.planYs[idx] : null;
    if (score == null || !Number.isFinite(score)) return pt;
    return { ...pt, score };
  });

  const projections = plan.projections.map((proj) => {
    const storePlan = pkg.byStore!.get(proj.store_id);
    if (!storePlan) return proj;
    const months = proj.months.map((pt) => {
      const idx = indexOf(pt.year, pt.month);
      const score = idx >= 0 ? storePlan.planYs[idx] : null;
      if (score == null || !Number.isFinite(score)) return pt;
      return { ...pt, score };
    });
    return { ...proj, months };
  });

  const last = chain_trajectory[chain_trajectory.length - 1];
  return {
    ...plan,
    chain_trajectory,
    projections,
    final_chain: last?.score ?? plan.final_chain,
  };
}

/**
 * Build Save payload overrides from an allocated pin package (planning-year months).
 */
export function storeMonthlyTargetsFromPackage(
  pkg: SlopePlanPackage,
  labels: string[],
  planningYear: number,
): { store_id: number; monthly_target: { year: number; month: number; score: number }[] }[] {
  if (!pkg.byStore || pkg.byStore.size === 0) {
    return [];
  }
  const out: {
    store_id: number;
    monthly_target: { year: number; month: number; score: number }[];
  }[] = [];
  for (const [storeId, series] of [...pkg.byStore.entries()].sort((a, b) => a[0] - b[0])) {
    const monthly_target: { year: number; month: number; score: number }[] = [];
    for (let i = 0; i < labels.length; i += 1) {
      const ym = parseYmLabel(labels[i]!);
      if (!ym || ym.year !== planningYear) continue;
      const score = series.planYs[i];
      if (score == null || !Number.isFinite(score)) continue;
      monthly_target.push({ year: ym.year, month: ym.month, score });
    }
    if (monthly_target.length === 0) {
      throw new Error(`store ${storeId} has no planning-year plan monthlies to save`);
    }
    out.push({ store_id: storeId, monthly_target });
  }
  return out;
}
