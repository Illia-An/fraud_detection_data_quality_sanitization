/**
 * Pinned Slope Plan trajectory (SPEC: slope_plan_point_drag).
 * Piecewise-linear history-cum path + monthlyFromCumulativePath invert + allocate gate.
 */

import {
  allocateStorePlansFromChain,
  type AllocateOpts,
  type StorePlanSeries,
  type YearMonth,
} from './chainStoreAllocate';
import {
  linearCumulativePathToTarget,
  monthlyFromCumulativePath,
} from './heroEvaluationSeries';

export type PlanPinKind = 'cumulative' | 'monthly';

export interface PlanPin {
  kind: PlanPinKind;
  /** Spine index (must be strictly after handoff, through horizon end). */
  monthIndex: number;
  value: number;
}

export type PinErrorCode =
  | 'invalid_month'
  | 'out_of_bounds'
  | 'target_miss'
  | 'pin_conflict'
  | 'allocate_infeasible'
  | 'empty_horizon';

export interface PinError {
  code: PinErrorCode;
  reason: string;
}

export interface TrajectoryHorizonInput {
  handoffIdx: number;
  handoffCum: number;
  handoffCount: number;
  /** Inclusive spine index of planning-year December (last plan month). */
  horizonEndIdx: number;
  target: number;
  floor?: number;
  ceiling?: number;
  pins: readonly PlanPin[];
}

export interface NetworkPlanSeries {
  /** Horizon-only cumulative path (length = horizon steps). */
  horizonCum: number[];
  /** Horizon-only monthlies (same length). */
  horizonMonthly: number[];
}

export interface AllocateGateContext {
  storeIds: number[];
  spine: YearMonth[];
  planningYear: number;
  /** Full-spine chain plan monthlies (fact through handoff + horizon). */
  chainPlanYs: (number | null)[];
  storeActualYs: Map<number, (number | null)[]>;
  entryScores: Map<number, number>;
  storeHistoryCumYs?: Map<number, (number | null)[]>;
  opts?: AllocateOpts;
  /** Max |mean − chain| after allocate (default 0.05 for roundPct noise). */
  meanEpsilon?: number;
}

export interface SlopePlanPackage {
  pins: PlanPin[];
  horizonCum: number[];
  horizonMonthly: number[];
  /** Full-spine network series when fact mirrors provided. */
  planYs: (number | null)[];
  planCumYs: (number | null)[];
  byStore: Map<number, StorePlanSeries> | null;
}

export type TrajectoryResult =
  | { ok: true; package: SlopePlanPackage }
  | { ok: false; error: PinError };

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

function near(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Replace-or-add one pin for a month (one pin per monthIndex). Newest wins kind+value.
 */
export function replacePin(pins: readonly PlanPin[], next: PlanPin): PlanPin[] {
  const rest = pins.filter((p) => p.monthIndex !== next.monthIndex);
  return [...rest, next].sort((a, b) => a.monthIndex - b.monthIndex);
}

/**
 * Normalize API pins: at most one pin per month. Two entries for the same month → pin_conflict.
 */
export function normalizePins(pins: readonly PlanPin[]): { ok: true; pins: PlanPin[] } | { ok: false; error: PinError } {
  const seen = new Map<number, PlanPin>();
  for (const pin of pins) {
    if (seen.has(pin.monthIndex)) {
      return {
        ok: false,
        error: {
          code: 'pin_conflict',
          reason: `Two pins for monthIndex ${pin.monthIndex}; use replacePin for drag updates`,
        },
      };
    }
    seen.set(pin.monthIndex, pin);
  }
  return {
    ok: true,
    pins: [...seen.values()].sort((a, b) => a.monthIndex - b.monthIndex),
  };
}

function horizonSteps(handoffIdx: number, horizonEndIdx: number): number {
  if (horizonEndIdx <= handoffIdx) {
    return 0;
  }
  return horizonEndIdx - handoffIdx;
}

function spineToStep(monthIndex: number, handoffIdx: number): number {
  return monthIndex - handoffIdx - 1;
}

/**
 * Build horizon cumulative path with optional pins, then invert with monthlyFromCumulativePath.
 */
export function buildPinnedHorizonPath(
  input: TrajectoryHorizonInput,
): { ok: true; horizonCum: number[]; horizonMonthly: number[]; pins: PlanPin[] } | { ok: false; error: PinError } {
  const floor = input.floor ?? 0;
  const ceiling = input.ceiling ?? 100;
  const N = horizonSteps(input.handoffIdx, input.horizonEndIdx);
  if (N <= 0) {
    return { ok: false, error: { code: 'empty_horizon', reason: 'No future months after handoff' } };
  }

  const normalized = normalizePins(input.pins);
  if (!normalized.ok) {
    return normalized;
  }
  const pins = normalized.pins;

  for (const pin of pins) {
    if (pin.monthIndex <= input.handoffIdx || pin.monthIndex > input.horizonEndIdx) {
      return {
        ok: false,
        error: {
          code: 'invalid_month',
          reason: `Pin monthIndex ${pin.monthIndex} outside editable horizon (${input.handoffIdx + 1}..${input.horizonEndIdx})`,
        },
      };
    }
    if (!Number.isFinite(pin.value) || pin.value < floor || pin.value > ceiling) {
      return {
        ok: false,
        error: {
          code: 'out_of_bounds',
          reason: `Pin value ${pin.value} outside [${floor}, ${ceiling}]`,
        },
      };
    }
  }

  const pinByStep = new Map<number, PlanPin>();
  for (const pin of pins) {
    pinByStep.set(spineToStep(pin.monthIndex, input.handoffIdx), pin);
  }

  const path: number[] = Array.from({ length: N }, () => 0);
  let lastAnchorStep = -1;
  let lastAnchorCum = input.handoffCum;
  let i = 0;

  while (i < N) {
    const pin = pinByStep.get(i);

    if (pin?.kind === 'monthly') {
      // Fill any gap before this month along default linear-toward-target share.
      if (i > lastAnchorStep + 1) {
        const gapEnd = i - 1;
        const gapSteps = gapEnd - lastAnchorStep;
        const remainingStepsToEoy = N - 1 - lastAnchorStep;
        const interimCum = roundPct(
          lastAnchorCum +
            ((input.target - lastAnchorCum) * (gapEnd - lastAnchorStep)) / remainingStepsToEoy,
        );
        const segment = linearCumulativePathToTarget(lastAnchorCum, interimCum, gapSteps);
        for (let k = 0; k < segment.length; k += 1) {
          path[lastAnchorStep + 1 + k] = segment[k]!;
        }
        lastAnchorStep = gapEnd;
        lastAnchorCum = path[gapEnd]!;
      }
      const cPrev = i === 0 ? input.handoffCum : path[i - 1]!;
      const cPrevCount = input.handoffCount + i;
      const cNext = roundPct((pin.value + cPrevCount * cPrev) / (cPrevCount + 1));
      path[i] = cNext;
      lastAnchorStep = i;
      lastAnchorCum = cNext;
      i += 1;
      continue;
    }

    // Next cumulative anchor: cum pin at/after i, else EOY target at N-1.
    let nextStep = N - 1;
    let nextCum = input.target;
    for (let s = i; s < N; s += 1) {
      const p = pinByStep.get(s);
      if (p?.kind === 'cumulative') {
        nextStep = s;
        nextCum = p.value;
        break;
      }
      if (p?.kind === 'monthly') {
        // Stop before monthly — handled in its own branch after filling up to s-1.
        if (s > i) {
          // Fill linearly to s-1 toward default target share, then loop will hit monthly.
          nextStep = s - 1;
          const remainingStepsToEoy = N - 1 - lastAnchorStep;
          nextCum = roundPct(
            lastAnchorCum +
              ((input.target - lastAnchorCum) * (nextStep - lastAnchorStep)) / remainingStepsToEoy,
          );
        } else {
          // s === i should have been caught above
          nextStep = s;
        }
        break;
      }
    }

    if (nextStep < i) {
      return {
        ok: false,
        error: { code: 'target_miss', reason: 'Internal path builder stalled' },
      };
    }

    const steps = nextStep - lastAnchorStep;
    const segment = linearCumulativePathToTarget(lastAnchorCum, nextCum, steps);
    for (let k = 0; k < segment.length; k += 1) {
      path[lastAnchorStep + 1 + k] = segment[k]!;
    }
    lastAnchorStep = nextStep;
    lastAnchorCum = path[nextStep]!;
    i = nextStep + 1;
  }

  if (!near(path[N - 1]!, input.target, 0.05)) {
    // Last month cumulative pin may force a different end — reject.
    return {
      ok: false,
      error: {
        code: 'target_miss',
        reason: `EOY cumulative ${path[N - 1]} ≠ target ${input.target}`,
      },
    };
  }
  // Snap EOY to target for stable identity with baseline linear path.
  path[N - 1] = roundPct(input.target);

  const monthlies = monthlyFromCumulativePath(input.handoffCum, input.handoffCount, path);
  for (let k = 0; k < monthlies.length; k += 1) {
    const m = monthlies[k]!;
    if (!Number.isFinite(m) || m < floor - 1e-9 || m > ceiling + 1e-9) {
      return {
        ok: false,
        error: {
          code: 'out_of_bounds',
          reason: `Monthly at horizon step ${k} is ${m}, outside [${floor}, ${ceiling}]`,
        },
      };
    }
  }

  // Enforce monthly pin values (within roundPct).
  for (const pin of pins) {
    if (pin.kind !== 'monthly') continue;
    const step = spineToStep(pin.monthIndex, input.handoffIdx);
    if (!near(monthlies[step]!, pin.value, 0.05)) {
      return {
        ok: false,
        error: {
          code: 'target_miss',
          reason: `Monthly pin at ${pin.monthIndex} expected ${pin.value}, got ${monthlies[step]}`,
        },
      };
    }
  }

  return { ok: true, horizonCum: path, horizonMonthly: monthlies, pins };
}

/**
 * Verify equal-weight store mean tracks chain plan after allocate.
 */
export function assertAllocateFeasible(
  byStore: Map<number, StorePlanSeries>,
  chainPlanYs: (number | null)[],
  handoffIdx: number,
  meanEpsilon = 0.05,
): PinError | null {
  const ids = [...byStore.keys()];
  if (ids.length === 0) {
    return { code: 'allocate_infeasible', reason: 'No stores to allocate' };
  }
  for (let i = handoffIdx + 1; i < chainPlanYs.length; i += 1) {
    const chain = chainPlanYs[i];
    if (chain == null || !Number.isFinite(chain)) continue;
    let sum = 0;
    let n = 0;
    for (const id of ids) {
      const v = byStore.get(id)?.planYs[i];
      if (v == null || !Number.isFinite(v)) {
        return {
          code: 'allocate_infeasible',
          reason: `Store ${id} missing plan at month index ${i}`,
        };
      }
      sum += v;
      n += 1;
    }
    const mean = sum / n;
    if (Math.abs(mean - chain) > meanEpsilon) {
      return {
        code: 'allocate_infeasible',
        reason: `Store mean ${roundPct(mean)} ≠ chain ${chain} at month index ${i}`,
      };
    }
  }
  return null;
}

export interface RecomputeSlopePlanInput extends TrajectoryHorizonInput {
  /** Full spine length for planYs / planCumYs arrays. */
  spineLength: number;
  /** Mirror fact through handoff (inclusive). */
  factMonthlyThroughHandoff?: (number | null)[];
  factCumThroughHandoff?: (number | null)[];
  allocate?: AllocateGateContext;
}

/**
 * Full Phase-1 recompute: trajectory (+ optional allocate gate) → atomic package or error.
 */
export function recomputeSlopePlan(input: RecomputeSlopePlanInput): TrajectoryResult {
  const built = buildPinnedHorizonPath(input);
  if (!built.ok) {
    return built;
  }

  const { horizonCum, horizonMonthly, pins } = built;
  const planYs: (number | null)[] = Array.from({ length: input.spineLength }, () => null);
  const planCumYs: (number | null)[] = Array.from({ length: input.spineLength }, () => null);

  if (input.handoffIdx >= 0) {
    for (let i = 0; i <= input.handoffIdx && i < input.spineLength; i += 1) {
      planYs[i] = input.factMonthlyThroughHandoff?.[i] ?? null;
      planCumYs[i] = input.factCumThroughHandoff?.[i] ?? null;
    }
  }

  for (let k = 0; k < horizonMonthly.length; k += 1) {
    const idx = input.handoffIdx + 1 + k;
    if (idx >= input.spineLength) break;
    planYs[idx] = horizonMonthly[k]!;
    planCumYs[idx] = horizonCum[k]!;
  }

  let byStore: Map<number, StorePlanSeries> | null = null;
  if (input.allocate) {
    const a = input.allocate;
    byStore = allocateStorePlansFromChain(
      a.storeIds,
      a.spine,
      a.planningYear,
      planYs,
      a.storeActualYs,
      input.handoffIdx,
      a.entryScores,
      a.opts,
      a.storeHistoryCumYs,
    );
    const gate = assertAllocateFeasible(
      byStore,
      planYs,
      input.handoffIdx,
      a.meanEpsilon ?? 0.05,
    );
    if (gate) {
      return { ok: false, error: gate };
    }
  }

  return {
    ok: true,
    package: {
      pins,
      horizonCum,
      horizonMonthly,
      planYs,
      planCumYs,
      byStore,
    },
  };
}
