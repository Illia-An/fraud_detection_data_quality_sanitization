/**
 * Build recompute inputs from Slope layers + simulation; overlay packages onto layers.
 */

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import {
  buildAllocatedStorePlans,
  inferSlopeSpineStart,
  monthSpan,
  scoreAt,
  ymLabel,
} from './cumulativeSlopeLayers';
import type { PlanPin, PlanPinKind, SlopePlanPackage } from './planTrajectoryPins';
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

export function recomputePinnedSlopePlan(
  layers: CumulativeSlopePlotLayers,
  sim: SimulationResponse,
  pins: readonly PlanPin[],
): TrajectoryResult {
  const handoffIdx = layers.cutover.factEndIndex;
  if (handoffIdx < 0) {
    return {
      ok: false,
      error: { code: 'empty_horizon', reason: 'No fact handoff to start plan from' },
    };
  }
  const handoffCum = layers.cumActualSimYs[handoffIdx];
  if (handoffCum == null || !Number.isFinite(handoffCum)) {
    return {
      ok: false,
      error: { code: 'empty_horizon', reason: 'Missing history cumulative at handoff' },
    };
  }

  let handoffCount = 0;
  for (let i = 0; i <= handoffIdx; i += 1) {
    if (layers.actualYs[i] != null) handoffCount += 1;
  }
  if (handoffCount < 1) handoffCount = 1;

  let horizonEndIdx = -1;
  const spineStart = inferSlopeSpineStart(sim);
  const spine = monthSpan(spineStart, { year: sim.planning_year, month: 12 });
  for (let i = 0; i < spine.length; i += 1) {
    if (spine[i]!.year === sim.planning_year || spine[i]!.year < sim.planning_year) {
      horizonEndIdx = i;
    }
  }
  // Prefer label length alignment with layers.
  horizonEndIdx = Math.min(horizonEndIdx, layers.labels.length - 1);
  for (let i = layers.labels.length - 1; i >= 0; i -= 1) {
    const lab = layers.labels[i]!;
    if (lab.startsWith(`${sim.planning_year}-`)) {
      horizonEndIdx = i;
      break;
    }
  }

  const allocatedMeta = buildAllocatedStorePlans(sim);
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

  return recomputeSlopePlan({
    handoffIdx,
    handoffCum,
    handoffCount,
    horizonEndIdx,
    target: layers.target,
    pins: [...pins],
    spineLength: layers.labels.length,
    factMonthlyThroughHandoff: layers.actualYs,
    factCumThroughHandoff: layers.cumActualSimYs,
    floor: 0,
    ceiling: 100,
    allocate: {
      storeIds,
      spine: allocatedMeta.spine,
      planningYear: sim.planning_year,
      chainPlanYs: [],
      storeActualYs,
      entryScores,
      storeHistoryCumYs,
      opts: { floor: 0, ceiling: 100 },
    },
  });
}

export function applyDragPin(
  layers: CumulativeSlopePlotLayers,
  sim: SimulationResponse,
  currentPins: readonly PlanPin[],
  kind: PlanPinKind,
  monthIndex: number,
  value: number,
): TrajectoryResult {
  const pins = replacePin(currentPins, { kind, monthIndex, value });
  return recomputePinnedSlopePlan(layers, sim, pins);
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

function parseLabel(label: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
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
      const ym = parseLabel(labels[i]!);
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
