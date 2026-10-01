/** Pure helpers for At-risk exception row enrichment (priority / context columns). */

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

export interface StoreBaselineRow {
  store_id: number;
  five_percent: number;
}

export function previousCalendarMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month <= 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export function panelFact(
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.five_percent ?? null;
}

export function panelVolume(
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.survey_volume ?? null;
}

/** Fact(as-of) − Fact(prev month); null if either missing. */
export function momTrendPp(
  panel: SanitizedPanel,
  storeId: number,
  asOfYear: number,
  asOfMonth: number,
): number | null {
  const curr = panelFact(panel, storeId, asOfYear, asOfMonth);
  const prev = previousCalendarMonth(asOfYear, asOfMonth);
  const prevFact = panelFact(panel, storeId, prev.year, prev.month);
  if (curr == null || prevFact == null) {
    return null;
  }
  return Math.round((curr - prevFact) * 100) / 100;
}

/**
 * Consecutive months ≤ as-of where actual − planned < −bandPp (newest first).
 * Uses store projection months that have panel actuals.
 */
export function behindStreakMonths(
  plan: FivePercentPlan,
  panel: SanitizedPanel,
  storeId: number,
  asOfYear: number,
  asOfMonth: number,
  bandPp: number,
): number {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection) {
    return 0;
  }
  const asOfKey = periodLabel(asOfYear, asOfMonth);
  const eligible = [...projection.months]
    .filter((m) => periodLabel(m.year, m.month) <= asOfKey)
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));

  let streak = 0;
  for (const point of eligible) {
    const actual = panelFact(panel, storeId, point.year, point.month);
    if (actual == null) {
      break;
    }
    const deviation = actual - point.score;
    if (deviation < -bandPp) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function planEndScore(plan: FivePercentPlan, storeId: number): number | null {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection || projection.months.length === 0) {
    return null;
  }
  const last = projection.months[projection.months.length - 1];
  return last.score;
}

export function baselineScore(
  baselineRows: StoreBaselineRow[],
  storeId: number,
): number | null {
  const hit = baselineRows.find((r) => r.store_id === storeId);
  return hit?.five_percent ?? null;
}

/** Share of absolute behind-plan gap for this store (0–1); null if not behind. */
export function gapShareOfBehind(
  gapPp: number | null,
  totalBehindAbsGap: number,
): number | null {
  if (gapPp == null || gapPp >= 0 || totalBehindAbsGap <= 0) {
    return null;
  }
  return Math.abs(gapPp) / totalBehindAbsGap;
}
