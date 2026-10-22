/** Shared score reading for 5% (`five_percent`) and TTS minutes (`tts`). */

export type MetricDirection = 'higher_is_better' | 'lower_is_better';

export interface DirectedMonthScore {
  year: number;
  month: number;
  score: number;
}

/** Fields both planners share. Extra metric fields on the concrete plan are preserved by generics. */
export interface DirectedPlan {
  direction: MetricDirection;
  unit: string;
  target: number;
  current_chain: number;
  required_change: number;
  final_chain: number;
  feasible: boolean;
  chain_trajectory: DirectedMonthScore[];
  projections: { store_id: number; months: DirectedMonthScore[] }[];
}

export interface MetricScoreRow {
  store_id: number;
  year: number;
  month: number;
  five_percent?: number;
  tts?: number;
  survey_volume?: number | null;
}

export interface MetricScorePanel {
  rows: MetricScoreRow[];
}

export function metricScore(
  row: { five_percent?: number; tts?: number } | null | undefined,
): number | null {
  if (row == null) {
    return null;
  }
  if (typeof row.tts === 'number' && Number.isFinite(row.tts)) {
    return row.tts;
  }
  if (typeof row.five_percent === 'number' && Number.isFinite(row.five_percent)) {
    return row.five_percent;
  }
  return null;
}

/** Signed deviation from plan (positive = better than planned). */
export function directionAwareDeviation(
  actual: number | null | undefined,
  planned: number | null | undefined,
  direction: MetricDirection = 'higher_is_better',
): number | null {
  if (actual == null || planned == null || !Number.isFinite(actual) || !Number.isFinite(planned)) {
    return null;
  }
  if (direction === 'higher_is_better') {
    return actual - planned;
  }
  return planned - actual;
}

/** Positive month-to-month change is worse only when fewer minutes are better. */
export function momIsDeterioration(
  delta: number | null,
  direction: MetricDirection = 'higher_is_better',
): boolean {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
    return false;
  }
  if (direction === 'lower_is_better') {
    return delta > 0;
  }
  return delta < 0;
}
