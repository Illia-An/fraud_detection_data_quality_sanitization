import type { StoreImpactPoint, StoreMonthCell } from '../../schemas/api';

export const STORE_IMPACT_COLORS = {
  actual: '#4C78A8',
  tier1: '#F58518',
  tier2: '#54A24B',
  tier3: '#EECA3B',
  tier4: '#B279A2',
  tier4Flag: '#EF4444',
} as const;

export const TIER4_BAND_FILL = 'rgba(239, 68, 68, 0.12)';
export const TIER4_HIGHLIGHT_BAND_FILL = 'rgba(239, 68, 68, 0.28)';
export const TIER4_HIGHLIGHT_BAND_LINE = 'rgba(185, 28, 28, 0.85)';

export interface PlotTrace {
  name: string;
  x: string[];
  y: (number | null)[];
  mode: 'lines+markers' | 'markers';
  line?: { color: string; width: number };
  marker?: {
    size: number | number[];
    color: string | string[];
    line?: { color: string | string[]; width: number | number[] };
  };
  connectgaps?: boolean;
  hovertemplate?: string;
  customdata?: (string | number)[][];
  showlegend?: boolean;
}

export interface PlotShape {
  type: 'rect';
  xref: 'x';
  yref: 'paper';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  fillcolor: string;
  line: { width: number; color?: string };
  layer: 'below';
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

/** Match backend ``_period_label``: YYYY-MM. */
export function storeMonthPeriodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Flagged Tier 4 store×months for the selected store. */
export function filterFlaggedMonthsForStore(
  cells: StoreMonthCell[],
  storeId: number,
): StoreMonthCell[] {
  return cells.filter((cell) => cell.store_id === storeId && cell.flagged);
}

/**
 * Vertical paper-height bands on categorical x (category index ±0.45).
 * Requires layout.xaxis.type = 'category' — otherwise Plotly date-parses
 * ``YYYY-MM`` labels and numeric shape coords collapse the axis to ~1970–2030.
 */
export function buildTier4FlagShapes(
  periodLabels: string[],
  flaggedCells: StoreMonthCell[],
): PlotShape[] {
  if (periodLabels.length === 0 || flaggedCells.length === 0) {
    return [];
  }
  const indexByLabel = new Map(periodLabels.map((label, index) => [label, index]));
  const shapes: PlotShape[] = [];
  for (const cell of flaggedCells) {
    const label = storeMonthPeriodLabel(cell.year, cell.month);
    const index = indexByLabel.get(label);
    if (index == null) {
      continue;
    }
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: index - 0.45,
      x1: index + 0.45,
      y0: 0,
      y1: 1,
      fillcolor: TIER4_BAND_FILL,
      line: { width: 0 },
      layer: 'below',
    });
  }
  return shapes;
}

/**
 * Stronger band for the month selected from FlaggedMonthsTable (same category axis).
 */
export function buildHighlightedMonthShape(
  periodLabels: string[],
  highlightedPeriodLabel: string | null,
): PlotShape | null {
  if (!highlightedPeriodLabel || periodLabels.length === 0) {
    return null;
  }
  const index = periodLabels.indexOf(highlightedPeriodLabel);
  if (index < 0) {
    return null;
  }
  return {
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: index - 0.45,
    x1: index + 0.45,
    y0: 0,
    y1: 1,
    fillcolor: TIER4_HIGHLIGHT_BAND_FILL,
    line: { width: 2, color: TIER4_HIGHLIGHT_BAND_LINE },
    layer: 'below',
  };
}

/** Force categorical months so ``YYYY-MM`` is never treated as a date axis. */
export function buildStoreImpactXAxis(periodLabels: string[]): {
  title: { text: string };
  type: 'category';
  categoryorder: 'array';
  categoryarray: string[];
} {
  return {
    title: { text: 'Month' },
    type: 'category',
    categoryorder: 'array',
    categoryarray: periodLabels,
  };
}

/**
 * Accent markers on Actual points for Tier 4 flagged months (tooltip: z / volume / 5%).
 */
export function buildTier4FlagMarkerTrace(
  points: StoreImpactPoint[],
  flaggedCells: StoreMonthCell[],
): PlotTrace | null {
  if (points.length === 0 || flaggedCells.length === 0) {
    return null;
  }
  const cellByLabel = new Map(
    flaggedCells.map((cell) => [storeMonthPeriodLabel(cell.year, cell.month), cell]),
  );
  const x: string[] = [];
  const y: number[] = [];
  const customdata: (string | number)[][] = [];

  for (const point of points) {
    const cell = cellByLabel.get(point.period_label);
    if (!cell) {
      continue;
    }
    x.push(point.period_label);
    y.push(point.actual_five_pct);
    customdata.push([cell.z, cell.volume, cell.five_pct]);
  }

  if (x.length === 0) {
    return null;
  }

  return {
    name: 'Tier 4 flagged',
    x,
    y,
    mode: 'markers',
    marker: {
      size: 11,
      color: 'rgba(239, 68, 68, 0.15)',
      line: { color: STORE_IMPACT_COLORS.tier4Flag, width: 2 },
    },
    customdata,
    hovertemplate:
      'Tier 4 flagged<br>z=%{customdata[0]:.2f}<br>volume=%{customdata[1]}<br>5%=%{customdata[2]:.1f}%<extra></extra>',
    showlegend: true,
  };
}
