/** Client-side plan monitoring from cleansed panel actuals (TASK-15 Phase B). */

import type { SanitizedPanel } from './sanitizedPanel';
import type { FivePercentPlan, MonthScore } from './plan';
import { periodLabel } from './plan';

export type MonitorSignal =
  | 'ahead_of_plan'
  | 'on_plan'
  | 'behind_plan'
  | 'insufficient_history';

export const SIGNAL_COLORS: Record<MonitorSignal, string> = {
  ahead_of_plan: '#2e7d32',
  on_plan: '#1565c0',
  behind_plan: '#c62828',
  insufficient_history: '#90a4ae',
};

export const SIGNAL_LABELS: Record<MonitorSignal, string> = {
  ahead_of_plan: 'Ahead',
  on_plan: 'On plan',
  behind_plan: 'Behind',
  insufficient_history: 'No actual',
};

export interface ChainMonthCompare {
  year: number;
  month: number;
  estimate: number;
  actual: number | null;
  delta: number | null;
}

export interface StoreMonitorRow {
  store_id: number;
  signal: MonitorSignal;
  planned: number | null;
  actual: number | null;
  deviation: number | null;
}

export interface PlanMonitoringInsights {
  as_of_year: number;
  as_of_month: number;
  band_pp: number;
  chain: {
    planned: number | null;
    actual: number | null;
    on_track: boolean | null;
  };
  months: ChainMonthCompare[];
  stores: StoreMonitorRow[];
  summary: {
    ahead: number;
    on_plan: number;
    behind: number;
    insufficient: number;
  };
}

function panelScoreMap(panel: SanitizedPanel): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of panel.rows) {
    map.set(`${row.store_id}|${periodLabel(row.year, row.month)}`, row.five_percent);
  }
  return map;
}

function chainActualForPeriod(
  panel: SanitizedPanel,
  year: number,
  month: number,
  storeIds: number[],
): number | null {
  const scores: number[] = [];
  for (const storeId of storeIds) {
    const row = panel.rows.find(
      (r) => r.store_id === storeId && r.year === year && r.month === month,
    );
    if (row) {
      scores.push(row.five_percent);
    }
  }
  if (scores.length === 0) {
    return null;
  }
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function classifyDeviation(deviation: number, bandPp: number): MonitorSignal {
  if (deviation > bandPp) {
    return 'ahead_of_plan';
  }
  if (deviation < -bandPp) {
    return 'behind_plan';
  }
  return 'on_plan';
}

export function buildChainMonthCompares(
  plan: FivePercentPlan,
  panel: SanitizedPanel,
): ChainMonthCompare[] {
  const storeIds = plan.projections.map((p) => p.store_id);
  return plan.chain_trajectory.map((point) => {
    const actual = chainActualForPeriod(panel, point.year, point.month, storeIds);
    return {
      year: point.year,
      month: point.month,
      estimate: point.score,
      actual,
      delta: actual == null ? null : actual - point.score,
    };
  });
}

/** Prefer last plan month that has any store actual in the panel; else last plan month. */
export function defaultAsOf(plan: FivePercentPlan, panel: SanitizedPanel): MonthScore {
  const scores = panelScoreMap(panel);
  let lastWithActual: MonthScore | null = null;
  for (const point of plan.chain_trajectory) {
    const hasActual = plan.projections.some((projection) =>
      scores.has(`${projection.store_id}|${periodLabel(point.year, point.month)}`),
    );
    if (hasActual) {
      lastWithActual = point;
    }
  }
  return lastWithActual ?? plan.chain_trajectory[plan.chain_trajectory.length - 1];
}

export function buildPlanMonitoringInsights(
  plan: FivePercentPlan,
  panel: SanitizedPanel,
  asOf: { year: number; month: number },
  bandPp = 1.0,
): PlanMonitoringInsights {
  const scores = panelScoreMap(panel);
  const months = buildChainMonthCompares(plan, panel);
  const stores: StoreMonitorRow[] = [];

  for (const projection of plan.projections) {
    const plannedPoint = projection.months.find(
      (m) => m.year === asOf.year && m.month === asOf.month,
    );
    const planned = plannedPoint?.score ?? null;
    const actualKey = `${projection.store_id}|${periodLabel(asOf.year, asOf.month)}`;
    const actual = scores.has(actualKey) ? scores.get(actualKey)! : null;

    if (planned == null || actual == null) {
      stores.push({
        store_id: projection.store_id,
        signal: 'insufficient_history',
        planned,
        actual,
        deviation: null,
      });
      continue;
    }
    const deviation = actual - planned;
    stores.push({
      store_id: projection.store_id,
      signal: classifyDeviation(deviation, bandPp),
      planned,
      actual,
      deviation,
    });
  }

  stores.sort((a, b) => (a.deviation ?? 0) - (b.deviation ?? 0));

  const summary = {
    ahead: stores.filter((s) => s.signal === 'ahead_of_plan').length,
    on_plan: stores.filter((s) => s.signal === 'on_plan').length,
    behind: stores.filter((s) => s.signal === 'behind_plan').length,
    insufficient: stores.filter((s) => s.signal === 'insufficient_history').length,
  };

  const chainMonth = months.find((m) => m.year === asOf.year && m.month === asOf.month);
  const chainPlanned = chainMonth?.estimate ?? null;
  const chainActual = chainMonth?.actual ?? null;
  let onTrack: boolean | null = null;
  if (chainPlanned != null && chainActual != null) {
    onTrack = chainActual + 1e-9 >= chainPlanned - bandPp;
  }

  return {
    as_of_year: asOf.year,
    as_of_month: asOf.month,
    band_pp: bandPp,
    chain: {
      planned: chainPlanned,
      actual: chainActual,
      on_track: onTrack,
    },
    months,
    stores,
    summary,
  };
}
