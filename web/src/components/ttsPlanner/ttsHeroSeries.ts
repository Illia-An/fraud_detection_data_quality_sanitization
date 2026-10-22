import { periodLabel } from '../../schemas/plan';
import type { TtsKpiPanel } from '../../schemas/ttsKpiPanel';
import type { TtsPlan } from '../../schemas/ttsPlan';

export interface TtsHeroPoint {
  label: string;
  minutes: number;
}

/** Equal-weight chain for every month in the panel, oldest first. */
export function historyChain(panel: TtsKpiPanel): TtsHeroPoint[] {
  const buckets = new Map<string, { year: number; month: number; sum: number; count: number }>();
  for (const row of panel.rows) {
    const label = periodLabel(row.year, row.month);
    const bucket = buckets.get(label) ?? {
      year: row.year,
      month: row.month,
      sum: 0,
      count: 0,
    };
    bucket.sum += row.tts;
    bucket.count += 1;
    buckets.set(label, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((bucket) => ({
      label: periodLabel(bucket.year, bucket.month),
      minutes: bucket.sum / bucket.count,
    }));
}

export function planChain(plan: TtsPlan): TtsHeroPoint[] {
  return plan.chain_trajectory.map((point) => ({
    label: periodLabel(point.year, point.month),
    minutes: point.score,
  }));
}

/** Plan minutes do not rise. A flat hold at the target still counts. */
export function planDoesNotRise(plan: TtsPlan): boolean {
  let previous = plan.current_chain;
  for (const point of plan.chain_trajectory) {
    if (point.score > previous + 1e-9) {
      return false;
    }
    previous = point.score;
  }
  return plan.final_chain <= plan.current_chain + 1e-9;
}
