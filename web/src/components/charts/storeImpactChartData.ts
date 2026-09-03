import type { PipelineConfig, StoreImpactPoint } from '../../schemas/api';

export const STORE_IMPACT_COLORS = {
  actual: '#4C78A8',
  tier1: '#F58518',
  tier2: '#54A24B',
  tier3: '#72B7B2',
} as const;

export interface PlotTrace {
  name: string;
  x: string[];
  y: (number | null)[];
  mode: 'lines+markers';
  line: { color: string; width: number };
  connectgaps: boolean;
}

export function getStoreIds(series: StoreImpactPoint[]): number[] {
  return [...new Set(series.map((point) => point.store_id))].sort((a, b) => a - b);
}

export function filterStoreSeries(
  series: StoreImpactPoint[],
  storeId: number,
): StoreImpactPoint[] {
  return series
    .filter((point) => point.store_id === storeId)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

export function buildStoreImpactTraces(
  points: StoreImpactPoint[],
  config: PipelineConfig,
): PlotTrace[] {
  const x = points.map((point) => point.period_label);
  const traces: PlotTrace[] = [
    {
      name: 'Actual',
      x,
      y: points.map((point) => point.actual_five_pct),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.actual, width: 2 },
      connectgaps: true,
    },
    {
      name: 'After Tier 1',
      x,
      y: points.map((point) => point.after_tier1_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier1, width: 2 },
      connectgaps: true,
    },
  ];

  if (config.tier2.enabled) {
    traces.push({
      name: 'After Tier 2',
      x,
      y: points.map((point) => point.after_tier2_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier2, width: 2 },
      connectgaps: true,
    });
  }

  if (config.tier3.enabled) {
    traces.push({
      name: 'After Tier 3',
      x,
      y: points.map((point) => point.after_tier3_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier3, width: 2 },
      connectgaps: true,
    });
  }

  return traces;
}

export function defaultSelectedStoreId(
  series: StoreImpactPoint[],
  current: number | null,
): number | null {
  const storeIds = getStoreIds(series);
  if (storeIds.length === 0) {
    return null;
  }
  if (current != null && storeIds.includes(current)) {
    return current;
  }
  return storeIds.includes(1) ? 1 : storeIds[0];
}
