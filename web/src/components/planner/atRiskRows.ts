import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import type { MonitorSignal, PlanMonitoringInsights } from '../../schemas/planMonitoring';
import {
  baselineScore,
  behindStreakMonths,
  gapShareOfBehind,
  momTrendPp,
  panelVolume,
  planEndScore,
  type StoreBaselineRow,
} from './atRiskRowMetrics';
import { FIGMA_FONT_MONO } from './figmaPlannerLayout';

/** Exception filters — Behind | Ahead | Top Gainers | Top Laggards | All Stores. */
export type AtRiskFilter = 'behind' | 'ahead' | 'top_gainers' | 'top_laggards' | 'all';

export interface AtRiskRow {
  storeId: number;
  volume: number | null;
  actual: number | null;
  targetAtAsOf: number | null;
  gapPp: number | null;
  momPp: number | null;
  baseline: number | null;
  endScore: number | null;
  streak: number;
  gapShare: number | null;
  liftToEnd: number | null;
  signal: MonitorSignal;
  status: string;
}

export function statusLabel(signal: MonitorSignal): string {
  if (signal === 'behind_plan') {
    return 'Behind Plan';
  }
  if (signal === 'ahead_of_plan') {
    return 'Ahead';
  }
  if (signal === 'insufficient_history') {
    return 'No actual';
  }
  return 'On plan';
}

/** Deficit strip scale — |gap| capped at 10 pp, or 1 min, → 100%. */
export function deficitProgress01(gapPp: number | null, unit: string): number {
  if (gapPp == null || gapPp >= 0) {
    return 0;
  }
  const cap = unit === 'min' ? 1 : 10;
  return Math.min(1, Math.abs(gapPp) / cap);
}

export function formatScore(value: number | null, unit: string): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (unit === 'min') {
    return `${value.toFixed(2)} min`;
  }
  return `${value.toFixed(1)}%`;
}

export function formatGap(value: number | null, unit: string): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  if (unit === 'min') {
    return `${sign}${Math.abs(value).toFixed(2)} min`;
  }
  return `${sign}${Math.abs(value).toFixed(1)} pp`;
}

export function formatShare(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(0)}%`;
}

export function formatVolume(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString();
}

export const TOP_SLICE_LIMIT = 15;

export function buildAtRiskRows(args: {
  plan: DirectedPlan;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  baselineRows: StoreBaselineRow[];
  filter: AtRiskFilter;
}): AtRiskRow[] {
  const { plan, panel, insights, baselineRows, filter } = args;
  const totalBehindAbsGap = insights.stores
    .filter((s) => s.signal === 'behind_plan' && s.deviation != null && s.deviation < 0)
    .reduce((sum, s) => sum + Math.abs(s.deviation!), 0);

  const built = plan.projections.map((projection) => {
    const storeId = projection.store_id;
    const monitor = insights.stores.find((s) => s.store_id === storeId);
    const signal = monitor?.signal ?? 'insufficient_history';
    const actual = monitor?.actual ?? null;
    const targetAtAsOf = monitor?.planned ?? null;
    const gapPp = monitor?.deviation ?? null;
    const baseline = baselineScore(baselineRows, storeId);
    const endScore = planEndScore(plan, storeId);
    const liftToEnd =
      actual != null && endScore != null
        ? Math.round((endScore - actual) * 100) / 100
        : null;
    return {
      storeId,
      volume: panelVolume(panel, storeId, insights.as_of_year, insights.as_of_month),
      actual,
      targetAtAsOf,
      gapPp,
      momPp: momTrendPp(panel, storeId, insights.as_of_year, insights.as_of_month),
      baseline,
      endScore,
      streak: behindStreakMonths(
        plan,
        panel,
        storeId,
        insights.as_of_year,
        insights.as_of_month,
        insights.band_pp,
      ),
      gapShare: gapShareOfBehind(gapPp, totalBehindAbsGap),
      liftToEnd,
      signal,
      status: statusLabel(signal),
    } satisfies AtRiskRow;
  });

  if (filter === 'behind') {
    return built
      .filter((r) => r.signal === 'behind_plan')
      .sort((a, b) => (a.gapPp ?? 0) - (b.gapPp ?? 0));
  }
  if (filter === 'ahead') {
    return built
      .filter((r) => r.signal === 'ahead_of_plan')
      .sort((a, b) => (b.gapPp ?? 0) - (a.gapPp ?? 0));
  }
  if (filter === 'top_gainers') {
    return [...built]
      .sort((a, b) => (b.gapPp ?? -999) - (a.gapPp ?? -999))
      .slice(0, TOP_SLICE_LIMIT);
  }
  if (filter === 'top_laggards') {
    return [...built]
      .sort((a, b) => (a.gapPp ?? 999) - (b.gapPp ?? 999))
      .slice(0, TOP_SLICE_LIMIT);
  }
  return [...built].sort((a, b) => {
    const rank = (s: MonitorSignal) =>
      s === 'behind_plan' ? 0 : s === 'insufficient_history' ? 1 : s === 'on_plan' ? 2 : 3;
    const d = rank(a.signal) - rank(b.signal);
    return d !== 0 ? d : (a.gapPp ?? 0) - (b.gapPp ?? 0);
  });
}

export const atRiskCellSx = {
  py: 0.5,
  px: 1.25,
  fontSize: '0.75rem',
  lineHeight: '20px',
  fontFamily: FIGMA_FONT_MONO,
  fontVariantNumeric: 'tabular-nums',
} as const;

export const atRiskHeadSx = {
  ...atRiskCellSx,
  fontWeight: 700,
  bgcolor: 'grey.50',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
  textAlign: 'right' as const,
} as const;

export const atRiskStoreHeadSx = {
  ...atRiskHeadSx,
  textAlign: 'left' as const,
  fontFamily: 'inherit',
} as const;
