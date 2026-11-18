/**
 * Step 4 of Slope Plan: allocate chain (network) monthly Plan to stores,
 * then build each store's history cumulative Plan from those monthlies.
 */

export interface AllocateOpts {
  floor?: number;
  ceiling?: number;
  /** Gap^power priority (stores further from chain level get more of the move). */
  priorityPower?: number;
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, floor: number, ceiling: number): number {
  return Math.min(ceiling, Math.max(floor, value));
}

/**
 * Move store scores so the equal-weight mean hits `chainLevel` (one month).
 * Priority: stores further below (or above, if lowering) the chain level.
 */
export function allocateStoresToChainLevel(
  current: ReadonlyMap<number, number>,
  chainLevel: number,
  opts: AllocateOpts = {},
): Map<number, number> {
  const floor = opts.floor ?? 0;
  const ceiling = opts.ceiling ?? 100;
  const priorityPower = opts.priorityPower ?? 1;
  const ids = [...current.keys()].sort((a, b) => a - b);
  const n = ids.length;
  if (n === 0) {
    return new Map();
  }
  const weight = 1 / n;
  const scores = new Map(
    ids.map((id) => [id, clamp(current.get(id)!, floor, ceiling)]),
  );

  const meanOf = (): number =>
    ids.reduce((sum, id) => sum + scores.get(id)!, 0) / n;

  for (let iter = 0; iter < 40; iter += 1) {
    const required = chainLevel - meanOf();
    if (Math.abs(required) <= 1e-8) {
      break;
    }
    const higher = required > 0;
    const capacity = new Map<number, number>();
    const priority = new Map<number, number>();
    for (const id of ids) {
      const value = scores.get(id)!;
      if (higher) {
        const room = Math.max(0, ceiling - value);
        const gap = Math.max(0, chainLevel - value);
        capacity.set(id, room);
        priority.set(id, gap > 0 ? gap ** priorityPower : room * 0.01);
      } else {
        const room = Math.max(0, value - floor);
        const gap = Math.max(0, value - chainLevel);
        capacity.set(id, room);
        priority.set(id, gap > 0 ? gap ** priorityPower : room * 0.01);
      }
    }
    if ([...capacity.values()].every((c) => c <= 1e-12)) {
      break;
    }
    const denom = ids.reduce((sum, id) => sum + weight * priority.get(id)!, 0);
    if (denom <= 0) {
      const capable = ids.filter((id) => capacity.get(id)! > 1e-12);
      if (capable.length === 0) {
        break;
      }
      const per = (required * n) / capable.length;
      for (const id of capable) {
        const value = scores.get(id)!;
        const cap = capacity.get(id)!;
        const add = higher ? Math.min(cap, Math.max(0, per)) : Math.max(-cap, Math.min(0, per));
        scores.set(id, clamp(value + add, floor, ceiling));
      }
      continue;
    }
    for (const id of ids) {
      const value = scores.get(id)!;
      const cap = capacity.get(id)!;
      const raw = priority.get(id)! * (required / denom);
      const add = higher
        ? Math.min(cap, Math.max(0, raw))
        : Math.max(-cap, Math.min(0, raw));
      scores.set(id, clamp(value + add, floor, ceiling));
    }
  }

  return new Map(ids.map((id) => [id, roundPct(scores.get(id)!)]));
}

export interface StorePlanSeries {
  planYs: (number | null)[];
  planCumYs: (number | null)[];
}

export interface YearMonth {
  year: number;
  month: number;
}

/**
 * Through `handoffIdx` (inclusive): mirror each store's actual (full history spine).
 * After handoff: allocate so equal-weight mean matches chain Plan monthly.
 * Store planCum mirrors seeded history cum through handoff, then continues the
 * running mean with allocated monthlies (same grain as network Plan).
 */
export function allocateStorePlansFromChain(
  storeIds: number[],
  spine: YearMonth[],
  _planningYear: number,
  chainPlanYs: (number | null)[],
  storeActualYs: Map<number, (number | null)[]>,
  handoffIdx: number,
  entryScores: Map<number, number>,
  opts: AllocateOpts = {},
  /** Optional history-cum series per store (through handoff); preferred over recompute. */
  storeHistoryCumYs?: Map<number, (number | null)[]>,
): Map<number, StorePlanSeries> {
  const n = spine.length;
  const ids = [...storeIds].sort((a, b) => a - b);
  const planByStore = new Map<number, (number | null)[]>(
    ids.map((id) => [id, Array.from({ length: n }, () => null)]),
  );

  const current = new Map<number, number>();
  for (const id of ids) {
    current.set(id, entryScores.get(id) ?? 0);
  }

  for (let i = 0; i < n; i += 1) {
    if (handoffIdx >= 0 && i <= handoffIdx) {
      for (const id of ids) {
        const actual = storeActualYs.get(id)?.[i] ?? null;
        planByStore.get(id)![i] = actual;
        if (actual != null) {
          current.set(id, actual);
        }
      }
      continue;
    }
    const chainLevel = chainPlanYs[i];
    if (chainLevel == null || !Number.isFinite(chainLevel)) {
      continue;
    }
    const next = allocateStoresToChainLevel(current, chainLevel, opts);
    for (const id of ids) {
      const score = next.get(id)!;
      planByStore.get(id)![i] = score;
      current.set(id, score);
    }
  }

  const out = new Map<number, StorePlanSeries>();
  for (const id of ids) {
    const planYs = planByStore.get(id)!;
    const seededCum = storeHistoryCumYs?.get(id);
    const planCumYs: (number | null)[] = Array.from({ length: n }, () => null);
    let sum = 0;
    let count = 0;
    if (handoffIdx >= 0) {
      for (let i = 0; i <= handoffIdx; i += 1) {
        const seeded = seededCum?.[i] ?? null;
        if (seeded != null) {
          planCumYs[i] = seeded;
        }
        if (planYs[i] != null) {
          count += 1;
        }
      }
      const handoffCum = planCumYs[handoffIdx];
      if (handoffCum != null && count >= 1) {
        sum = handoffCum * count;
      } else {
        sum = 0;
        count = 0;
        for (let i = 0; i <= handoffIdx; i += 1) {
          const monthly = planYs[i];
          if (monthly == null) {
            planCumYs[i] = count === 0 ? null : roundPct(sum / count);
            continue;
          }
          sum += monthly;
          count += 1;
          planCumYs[i] = roundPct(sum / count);
        }
      }
      for (let i = handoffIdx + 1; i < n; i += 1) {
        const monthly = planYs[i];
        if (monthly == null) {
          planCumYs[i] = count === 0 ? null : roundPct(sum / count);
          continue;
        }
        sum += monthly;
        count += 1;
        planCumYs[i] = roundPct(sum / count);
      }
    } else {
      for (let i = 0; i < n; i += 1) {
        const monthly = planYs[i];
        if (monthly == null) {
          planCumYs[i] = count === 0 ? null : roundPct(sum / count);
          continue;
        }
        sum += monthly;
        count += 1;
        planCumYs[i] = roundPct(sum / count);
      }
    }
    out.set(id, { planYs, planCumYs });
  }
  return out;
}
