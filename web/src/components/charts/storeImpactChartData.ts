import type { StoreImpactPoint } from '../../schemas/api';

export const STORE_IMPACT_COLORS = {
  actual: '#4C78A8',
  tier1: '#F58518',
  tier2: '#54A24B',
  tier3: '#EECA3B',
  tier4: '#B279A2',
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

export function buildStoreImpactTraces(points: StoreImpactPoint[]): PlotTrace[] {
  const x = points.map((point) => point.period_label);
  return [
    {
      name: 'Actual',
      x,
      y: points.map((point) => point.actual_five_pct),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.actual, width: 2 },
      connectgaps: true,
    },
    {
      name: 'After Tier 1 (BlackList)',
      x,
      y: points.map((point) => point.after_tier1_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier1, width: 2 },
      connectgaps: true,
    },
    {
      name: 'After Tier 2 (Frequency)',
      x,
      y: points.map((point) => point.after_tier2_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier2, width: 2 },
      connectgaps: true,
    },
    {
      name: 'After Tier 3 (Always top-box)',
      x,
      y: points.map((point) => point.after_tier3_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier3, width: 2 },
      connectgaps: true,
    },
    {
      name: 'After Tier 4 (Store×month)',
      x,
      y: points.map((point) => point.after_tier4_five_pct ?? null),
      mode: 'lines+markers',
      line: { color: STORE_IMPACT_COLORS.tier4, width: 2 },
      connectgaps: true,
    },
  ];
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

/** Default: zoom Y to local data range so 1–3 pp shifts stay readable. */
export type StoreImpactYScaleMode = 'fit' | 'full';

export interface StoreImpactYAxis {
  title: { text: string };
  rangemode?: 'tozero' | 'normal' | 'nonnegative';
  range?: [number, number];
}

const Y_AXIS_TITLE = { text: 'Top-box rate (%)' } as const;
const FIT_PAD_RATIO = 0.08;
const FIT_PAD_MIN_PP = 1;

/** Collect numeric top-box % values used by Store impact traces. */
export function collectStoreImpactYValues(points: StoreImpactPoint[]): number[] {
  const values: number[] = [];
  for (const point of points) {
    values.push(point.actual_five_pct);
    if (point.after_tier1_five_pct != null) values.push(point.after_tier1_five_pct);
    if (point.after_tier2_five_pct != null) values.push(point.after_tier2_five_pct);
    if (point.after_tier3_five_pct != null) values.push(point.after_tier3_five_pct);
    if (point.after_tier4_five_pct != null) values.push(point.after_tier4_five_pct);
  }
  return values;
}

/**
 * Plotly y-axis for Store impact.
 * - ``fit``: local min/max with padding (no forced zero).
 * - ``full``: fixed 0–100% scale.
 */
export function buildStoreImpactYAxis(
  mode: StoreImpactYScaleMode,
  values: number[],
): StoreImpactYAxis {
  if (mode === 'full') {
    return { title: Y_AXIS_TITLE, range: [0, 100] };
  }

  if (values.length === 0) {
    return { title: Y_AXIS_TITLE, range: [0, 100] };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, FIT_PAD_MIN_PP);
  const pad = Math.max(span * FIT_PAD_RATIO, FIT_PAD_MIN_PP);
  const lo = Math.max(0, rawMin - pad);
  const hi = Math.min(100, rawMax + pad);

  // Degenerate / near-full span — keep a readable band without collapsing to a point.
  if (hi - lo < FIT_PAD_MIN_PP) {
    const mid = (lo + hi) / 2;
    return {
      title: Y_AXIS_TITLE,
      range: [Math.max(0, mid - FIT_PAD_MIN_PP), Math.min(100, mid + FIT_PAD_MIN_PP)],
    };
  }

  return { title: Y_AXIS_TITLE, range: [lo, hi] };
}
