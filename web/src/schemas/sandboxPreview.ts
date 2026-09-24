/** Sandbox even-split preview (TASK-15 Phase C) — client-only, does not mutate plan. */

import type { MonitorSignal } from './planMonitoring';

export interface SandboxStoreDelta {
  store_id: number;
  signal: MonitorSignal | 'selected';
  original: number;
  draft: number;
  applied_delta: number;
}

export interface SandboxEvenSplitPreview {
  selected_store_id: number;
  original: number;
  draft: number;
  /** Change applied to the selected store (draft − original). */
  taken: number;
  distributed: number;
  leftover: number;
  pool: SandboxStoreDelta[];
}

export interface ScoreBounds {
  min: number;
  max: number;
}

/** Allow ± max monthly improve around previous month, clipped to floor/ceiling. */
export function sandboxScoreBounds(
  previous: number | null,
  last: number,
  maxMonthlyImprove: number,
  floor = 0,
  ceiling = 100,
): ScoreBounds {
  const anchor = previous ?? last;
  return {
    min: Math.max(floor, anchor - maxMonthlyImprove),
    max: Math.min(ceiling, anchor + maxMonthlyImprove),
  };
}

export function clipSandboxScore(value: number, bounds: ScoreBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * Keep chain total roughly stable: offset −Δ of the selected store evenly
 * across other stores that still have room within floor/ceiling.
 */
export function previewSandboxEvenSplit(args: {
  selectedStoreId: number;
  selectedSignal: MonitorSignal;
  originalLast: number;
  proposedLast: number;
  previousScore: number | null;
  others: { store_id: number; last: number; signal: MonitorSignal }[];
  maxMonthlyImprove: number;
  floor?: number;
  ceiling?: number;
}): SandboxEvenSplitPreview {
  const floor = args.floor ?? 0;
  const ceiling = args.ceiling ?? 100;
  const bounds = sandboxScoreBounds(
    args.previousScore,
    args.originalLast,
    args.maxMonthlyImprove,
    floor,
    ceiling,
  );
  const draft = clipSandboxScore(args.proposedLast, bounds);
  const taken = draft - args.originalLast;
  let remaining = -taken;

  const pool: SandboxStoreDelta[] = args.others.map((row) => ({
    store_id: row.store_id,
    signal: row.signal,
    original: row.last,
    draft: row.last,
    applied_delta: 0,
  }));

  // Multi-pass even distribution with capacity (room toward floor/ceiling).
  for (let pass = 0; pass < 24 && Math.abs(remaining) > 1e-9; pass += 1) {
    const eligible = pool.filter((row) => {
      if (remaining < 0) {
        return row.draft > floor + 1e-9;
      }
      return row.draft < ceiling - 1e-9;
    });
    if (eligible.length === 0) {
      break;
    }
    const share = remaining / eligible.length;
    let placed = 0;
    for (const row of eligible) {
      const room =
        share < 0 ? floor - row.draft : ceiling - row.draft;
      const apply = share < 0 ? Math.max(share, room) : Math.min(share, room);
      row.draft += apply;
      row.applied_delta += apply;
      placed += apply;
    }
    remaining -= placed;
    if (Math.abs(placed) < 1e-12) {
      break;
    }
  }

  const distributed = Math.abs(taken) - Math.abs(remaining);
  return {
    selected_store_id: args.selectedStoreId,
    original: args.originalLast,
    draft,
    taken,
    distributed: Math.max(0, distributed),
    leftover: Math.abs(remaining),
    pool,
  };
}
