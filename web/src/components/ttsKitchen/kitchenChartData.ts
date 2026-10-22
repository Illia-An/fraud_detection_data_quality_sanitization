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
