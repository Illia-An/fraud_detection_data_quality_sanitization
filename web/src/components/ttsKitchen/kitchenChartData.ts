import type { KitchenMonth } from '../../schemas/ttsKitchen';

export interface KitchenPlotPoint {
  year: number;
  month: number;
  actual_mean_tts_sec: number | null;
  after_ge30_mean_tts_sec: number | null;
}

export function kitchenPlotPoints(months: KitchenMonth[]): KitchenPlotPoint[] {
  return [...months]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((month) => ({
      year: month.year,
      month: month.month,
      actual_mean_tts_sec: month.mean_before_sec,
      after_ge30_mean_tts_sec: month.mean_after_sec,
    }));
}

const FIT_PAD_RATIO = 0.08;
const FIT_PAD_MIN_SEC = 1;

/** Seconds drawn on the kitchen chart: before and after the threshold. */
export function collectKitchenMeanSeconds(points: KitchenPlotPoint[]): number[] {
  const values: number[] = [];
  for (const point of points) {
    if (point.actual_mean_tts_sec != null && Number.isFinite(point.actual_mean_tts_sec)) {
      values.push(point.actual_mean_tts_sec);
    }
    if (point.after_ge30_mean_tts_sec != null && Number.isFinite(point.after_ge30_mean_tts_sec)) {
      values.push(point.after_ge30_mean_tts_sec);
    }
  }
  return values;
}

/**
 * Y range in seconds, tightened to the visible means.
 * Padding stays in seconds. The axis is not forced through zero and is not a 0–100 scale.
 */
export function buildKitchenFitRange(values: number[]): [number, number] | null {
  if (values.length === 0) {
    return null;
  }
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, FIT_PAD_MIN_SEC);
  const pad = Math.max(span * FIT_PAD_RATIO, FIT_PAD_MIN_SEC);
  let lo = Math.max(0, rawMin - pad);
  let hi = rawMax + pad;
  if (hi - lo < FIT_PAD_MIN_SEC * 2) {
    const mid = (rawMin + rawMax) / 2;
    lo = Math.max(0, mid - FIT_PAD_MIN_SEC);
    hi = mid + FIT_PAD_MIN_SEC;
  }
  return [lo, hi];
}
