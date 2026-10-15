/**
 * YTD “pressure to target” required pair — separate from plan short-window (−3 / as-of).
 *
 * Knowledge: cleansed facts from January(yearStartYear) … last fact inclusive.
 * Pressure cumulative: YTD running mean from year start → last fact, then required
 * path to plan target month. Pressure monthly: from last fact onward (horizon H).
 * Horizon H ends at the plan target month (last chain_trajectory), not past it.
 */

import { periodLabel, type FivePercentPlan } from '../../schemas/plan';
import {
  cumulativeMeanSeries,
  linearCumulativePathToTarget,
  monthlyFromCumulativePath,
} from './heroEvaluationSeries';

export type HeroRequiredMode = 'plan' | 'pressure';

export interface PressureRequiredPair {
  yearStartLabel: string;
  /** Last non-null cleansed fact on the axis, or null when none. */
  lastFactLabel: string | null;
  lastFactIdx: number;
  /** Plan target month (last trajectory) used to cap H; null when uncapped. */
  horizonEndLabel: string | null;
  requiredMonthlyYs: (number | null)[];
  requiredCumulativeYs: (number | null)[];
}

function emptyPair(
  length: number,
  yearStartLabel: string,
  horizonEndLabel: string | null = null,
): PressureRequiredPair {
  return {
    yearStartLabel,
    lastFactLabel: null,
    lastFactIdx: -1,
    horizonEndLabel,
    requiredMonthlyYs: Array.from({ length }, () => null),
    requiredCumulativeYs: Array.from({ length }, () => null),
  };
}

/** Last month of the draft trajectory — plan target month for Pressure H. */
export function planTargetMonthLabel(draftPlan: FivePercentPlan): string | null {
  const traj = draftPlan.chain_trajectory;
  if (traj.length === 0) {
    return null;
  }
  const last = traj[traj.length - 1]!;
  return periodLabel(last.year, last.month);
}

/**
 * Build the pressure required monthly/cumulative pair on an existing Hero timeline.
 * Does not change planning as-of handoff — call only to overlay in Pressure mode.
 *
 * @param horizonEndLabel - inclusive plan target month (`YYYY-MM`). When set, H
 *   stops there even if the Hero axis continues (panel months past the plan).
 */
export function buildPressureRequiredPair(
  labels: string[],
  factYs: (number | null)[],
  target: number,
  yearStartYear: number,
  horizonEndLabel?: string | null,
): PressureRequiredPair {
  const yearStartLabel = periodLabel(yearStartYear, 1);
  const cappedEnd = horizonEndLabel ?? null;
  if (labels.length === 0 || factYs.length !== labels.length) {
    return emptyPair(labels.length, yearStartLabel, cappedEnd);
  }

  let lastFactIdx = -1;
  for (let i = 0; i < factYs.length; i += 1) {
    if (factYs[i] != null) {
      lastFactIdx = i;
    }
  }
  if (lastFactIdx < 0) {
    return emptyPair(labels.length, yearStartLabel, cappedEnd);
  }

  // Inclusive end index for H: last label ≤ plan target month (or axis end).
  let horizonEndIdx = labels.length - 1;
  if (cappedEnd != null) {
    horizonEndIdx = -1;
    for (let i = 0; i < labels.length; i += 1) {
      if (labels[i]! <= cappedEnd) {
        horizonEndIdx = i;
      }
    }
    if (horizonEndIdx < 0) {
      return emptyPair(labels.length, yearStartLabel, cappedEnd);
    }
  }

  // YTD facts only (Jan of year … last fact). String compare is safe for YYYY-MM.
  const ytdFactYs = factYs.map((value, i) => {
    if (value == null || i > lastFactIdx) {
      return null;
    }
    if (labels[i]! < yearStartLabel) {
      return null;
    }
    return value;
  });

  let handoffCount = 0;
  for (let i = 0; i <= lastFactIdx; i += 1) {
    if (ytdFactYs[i] != null) {
      handoffCount += 1;
    }
  }
  if (handoffCount < 1) {
    // All facts lie before year start — no YTD pressure base.
    return emptyPair(labels.length, yearStartLabel, cappedEnd);
  }

  const ytdCum = cumulativeMeanSeries(ytdFactYs);
  const startCum = ytdCum[lastFactIdx];
  if (startCum == null) {
    return emptyPair(labels.length, yearStartLabel, cappedEnd);
  }

  const horizonIdxs: number[] = [];
  for (let i = lastFactIdx + 1; i <= horizonEndIdx; i += 1) {
    horizonIdxs.push(i);
  }

  const pathToTarget =
    horizonIdxs.length === 0
      ? []
      : linearCumulativePathToTarget(startCum, target, horizonIdxs.length);
  const requiredMonthlies =
    pathToTarget.length === 0
      ? []
      : monthlyFromCumulativePath(startCum, handoffCount, pathToTarget);
  const requiredByIdx = new Map(
    horizonIdxs.map((idx, k) => [idx, requiredMonthlies[k]!]),
  );

  const requiredMonthlyYs = labels.map((_label, i) => {
    if (requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    if (i === lastFactIdx) {
      return factYs[i];
    }
    return null;
  });

  // Cumulative of (YTD facts + required monthlies) — twin of dashed monthly.
  const pressurePlanMonthlyYs = labels.map((_label, i) => {
    if (i > lastFactIdx && requiredByIdx.has(i)) {
      return requiredByIdx.get(i)!;
    }
    return ytdFactYs[i];
  });
  const pressureCumFull = cumulativeMeanSeries(pressurePlanMonthlyYs);
  // Show YTD history (year start … last fact) then required path through horizon end.
  const requiredCumulativeYs = pressureCumFull.map((value, i) => {
    if (value == null || i > horizonEndIdx) {
      return null;
    }
    return value;
  });

  return {
    yearStartLabel,
    lastFactLabel: labels[lastFactIdx]!,
    lastFactIdx,
    horizonEndLabel: cappedEnd ?? labels[horizonEndIdx]!,
    requiredMonthlyYs,
    requiredCumulativeYs,
  };
}
