/**
 * Order × Bump chart builders — same chrome as 5% StoreImpactChart,
 * mapped to bump TTS seconds (+ optional order TTS echo).
 */
import type { EvaluationLegendItem } from '../planner/EvaluationLegend';
import type { OrderBumpImpactPoint } from '../../schemas/ttsOrderBump';
import {
  YOY_MONTH_LABELS,
  applyTraceHoverFocus,
  buildStoreImpactXAxis,
  buildYoYImpactXAxis,
  toggleLegendHiddenName,
  type PlotTrace,
  type StoreImpactYAxis,
  type StoreImpactYScaleMode,
} from '../charts/storeImpactChartData';

export {
  applyTraceHoverFocus,
  buildStoreImpactXAxis,
  buildYoYImpactXAxis,
  toggleLegendHiddenName,
};
export type { PlotTrace, StoreImpactYScaleMode };

export const ORDER_BUMP_CHART_COLORS = {
  actual: '#4C78A8',
  ge30: '#54A24B',
  orderRaw: '#EECA3B',
  orderAfter: '#B279A2',
} as const;

const YOY_YEAR_COLORS = ['#4C78A8', '#E45756', '#54A24B', '#F58518', '#B279A2'] as const;

export const ORDER_BUMP_HOVER_TEMPLATE =
  '%{x}<br>%{fullData.name}: %{y:.1f} s<extra></extra>';

export const TRACE_NAME_ACTUAL = 'Kitchen TTS (raw)';
export const TRACE_NAME_GE30 = 'Kitchen TTS (≥30)';
export const TRACE_NAME_ORDER_RAW = 'Order TTS (TransH)';
export const TRACE_NAME_CYCLE = 'Kitchen window';
/** Kept so older imports still resolve; the subtract-lt30 series is not plotted. */
export const TRACE_NAME_ORDER_AFTER = 'Order TTS (after filter)';
/** @deprecated use TRACE_NAME_ORDER_RAW */
export const TRACE_NAME_ORDER_ECHO = TRACE_NAME_ORDER_RAW;

export const NETWORK_SERIES_STORE_ID = 0;

export function getOrderBumpStoreIds(series: OrderBumpImpactPoint[]): number[] {
  return [...new Set(series.map((p) => p.store_id))].sort((a, b) => a - b);
}

export function filterOrderBumpStoreSeries(
  series: OrderBumpImpactPoint[],
  storeId: number,
): OrderBumpImpactPoint[] {
  return series
    .filter((p) => p.store_id === storeId)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

export function defaultOrderBumpStoreId(
  series: OrderBumpImpactPoint[],
  preferred: number | null,
): number | null {
  const ids = getOrderBumpStoreIds(series);
  if (ids.length === 0) {
    return null;
  }
  if (preferred != null && ids.includes(preferred)) {
    return preferred;
  }
  return ids[0] ?? null;
}

function volumeWeightedMean(
  points: OrderBumpImpactPoint[],
  getMean: (p: OrderBumpImpactPoint) => number | null,
  getVol: (p: OrderBumpImpactPoint) => number | null,
): number | null {
  let sum = 0;
  let vol = 0;
  for (const p of points) {
    const mean = getMean(p);
    const v = getVol(p) ?? 0;
    if (mean == null || v <= 0) {
      continue;
    }
    sum += mean * v;
    vol += v;
  }
  return vol > 0 ? Math.round((sum / vol) * 10000) / 10000 : null;
}

function equalMean(
  points: OrderBumpImpactPoint[],
  getMean: (p: OrderBumpImpactPoint) => number | null,
): number | null {
  let sum = 0;
  let n = 0;
  for (const p of points) {
    const mean = getMean(p);
    if (mean == null) {
      continue;
    }
    sum += mean;
    n += 1;
  }
  return n > 0 ? Math.round((sum / n) * 10000) / 10000 : null;
}

/** Network: order-count-weighted kitchen means; equal-mean TransH order TTS. */
export function aggregateOrderBumpNetworkSeries(
  series: OrderBumpImpactPoint[],
): OrderBumpImpactPoint[] {
  const byPeriod = new Map<string, OrderBumpImpactPoint[]>();
  for (const point of series) {
    const key = point.period_label;
    const bucket = byPeriod.get(key);
    if (bucket) {
      bucket.push(point);
    } else {
      byPeriod.set(key, [point]);
    }
  }

  return [...byPeriod.keys()]
    .sort()
    .map((label) => {
      const points = byPeriod.get(label) ?? [];
      const sample = points[0];
      const volBefore = points.reduce((s, p) => s + (p.volume_before ?? 0), 0);
      const volAfter = points.reduce((s, p) => s + (p.volume_after ?? 0), 0);
      return {
        store_id: NETWORK_SERIES_STORE_ID,
        year: sample.year,
        month: sample.month,
        period_label: label,
        actual_mean_tts_sec: volumeWeightedMean(
          points,
          (p) => p.actual_mean_tts_sec,
          (p) => p.volume_before,
        ),
        after_ge30_mean_tts_sec: volumeWeightedMean(
          points,
          (p) => p.after_ge30_mean_tts_sec,
          (p) => p.volume_after,
        ),
        order_tts_mean_sec: equalMean(points, (p) => p.order_tts_mean_sec),
        order_tts_mean_after_sec: equalMean(points, (p) => p.order_tts_mean_after_sec),
        cycle_mean_sec: volumeWeightedMean(
          points,
          (p) => p.cycle_mean_sec,
          (p) => p.volume_cycle,
        ),
        volume_before: volBefore,
        volume_after: volAfter,
        volume_cycle: points.reduce((s, p) => s + (p.volume_cycle ?? 0), 0),
      };
    })
    .filter(
      (p) => p.actual_mean_tts_sec != null || p.after_ge30_mean_tts_sec != null,
    );
}

export function buildOrderBumpTimelineTraces(
  points: OrderBumpImpactPoint[],
): PlotTrace[] {
  const x = points.map((p) => p.period_label);
  return [
    {
      name: TRACE_NAME_ACTUAL,
      x,
      y: points.map((p) => p.actual_mean_tts_sec),
      mode: 'lines+markers',
      line: { color: ORDER_BUMP_CHART_COLORS.actual, width: 2.5, dash: 'solid' },
      connectgaps: true,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    },
    {
      name: TRACE_NAME_GE30,
      x,
      y: points.map((p) => p.after_ge30_mean_tts_sec),
      mode: 'lines+markers',
      line: { color: ORDER_BUMP_CHART_COLORS.ge30, width: 2, dash: 'dash' },
      connectgaps: true,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    },
    {
      name: TRACE_NAME_ORDER_RAW,
      x,
      y: points.map((p) => p.order_tts_mean_sec),
      mode: 'lines+markers',
      line: { color: ORDER_BUMP_CHART_COLORS.orderRaw, width: 1.5, dash: 'dot' },
      connectgaps: true,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    },
    {
      name: TRACE_NAME_CYCLE,
      x,
      y: points.map((p) => p.cycle_mean_sec),
      mode: 'lines+markers',
      line: { color: ORDER_BUMP_CHART_COLORS.orderAfter, width: 2, dash: 'dashdot' },
      connectgaps: true,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    },
  ];
}

/** YoY: Actual + ge30 per calendar year on shared month axis. */
export function buildOrderBumpYoYTraces(points: OrderBumpImpactPoint[]): PlotTrace[] {
  const byYear = new Map<number, OrderBumpImpactPoint[]>();
  for (const point of points) {
    const bucket = byYear.get(point.year);
    if (bucket) {
      bucket.push(point);
    } else {
      byYear.set(point.year, [point]);
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const traces: PlotTrace[] = [];

  years.forEach((year, yearIndex) => {
    const yearPoints = byYear.get(year) ?? [];
    const byMonth = new Map(yearPoints.map((p) => [p.month, p]));
    const color = YOY_YEAR_COLORS[yearIndex % YOY_YEAR_COLORS.length];
    const x = [...YOY_MONTH_LABELS];

    traces.push({
      name: `${year} · Actual`,
      x,
      y: YOY_MONTH_LABELS.map((_, i) => byMonth.get(i + 1)?.actual_mean_tts_sec ?? null),
      mode: 'lines+markers',
      line: { color, width: 2.5, dash: 'solid' },
      connectgaps: false,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    });
    traces.push({
      name: `${year} · ge30`,
      x,
      y: YOY_MONTH_LABELS.map(
        (_, i) => byMonth.get(i + 1)?.after_ge30_mean_tts_sec ?? null,
      ),
      mode: 'lines+markers',
      line: { color, width: 2, dash: 'dash' },
      connectgaps: false,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    });
    traces.push({
      name: `${year} · Order TTS`,
      x,
      y: YOY_MONTH_LABELS.map((_, i) => byMonth.get(i + 1)?.order_tts_mean_sec ?? null),
      mode: 'lines+markers',
      line: { color, width: 1.5, dash: 'dot' },
      connectgaps: false,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    });
    traces.push({
      name: `${year} · Window`,
      x,
      y: YOY_MONTH_LABELS.map((_, i) => byMonth.get(i + 1)?.cycle_mean_sec ?? null),
      mode: 'lines+markers',
      line: { color, width: 2, dash: 'dashdot' },
      connectgaps: false,
      hovertemplate: ORDER_BUMP_HOVER_TEMPLATE,
    });
  });

  return traces;
}

export function collectOrderBumpYValues(points: OrderBumpImpactPoint[]): number[] {
  const values: number[] = [];
  for (const p of points) {
    if (p.actual_mean_tts_sec != null) values.push(p.actual_mean_tts_sec);
    if (p.after_ge30_mean_tts_sec != null) values.push(p.after_ge30_mean_tts_sec);
    if (p.order_tts_mean_sec != null) values.push(p.order_tts_mean_sec);
    if (p.order_tts_mean_after_sec != null) values.push(p.order_tts_mean_after_sec);
    if (p.cycle_mean_sec != null) values.push(p.cycle_mean_sec);
  }
  return values;
}

export function collectOrderBumpYoYYValues(points: OrderBumpImpactPoint[]): number[] {
  const values: number[] = [];
  for (const p of points) {
    if (p.actual_mean_tts_sec != null) values.push(p.actual_mean_tts_sec);
    if (p.after_ge30_mean_tts_sec != null) values.push(p.after_ge30_mean_tts_sec);
    if (p.order_tts_mean_sec != null) values.push(p.order_tts_mean_sec);
    if (p.order_tts_mean_after_sec != null) values.push(p.order_tts_mean_after_sec);
    if (p.cycle_mean_sec != null) values.push(p.cycle_mean_sec);
  }
  return values;
}

const Y_TITLE = { text: 'Mean TTS (seconds)' } as const;
const FIT_PAD_RATIO = 0.08;
const FIT_PAD_MIN = 5;

/**
 * - ``fit``: zoom to local data range
 * - ``full``: from 0 to padded max (seconds analogue of 0–100%)
 */
export function buildOrderBumpYAxis(
  mode: StoreImpactYScaleMode,
  values: number[],
): StoreImpactYAxis {
  if (values.length === 0) {
    return { title: Y_TITLE, range: [0, 300] };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  if (mode === 'full') {
    const hi = Math.max(rawMax * 1.08, rawMax + FIT_PAD_MIN);
    return { title: Y_TITLE, range: [0, hi] };
  }

  const span = Math.max(rawMax - rawMin, FIT_PAD_MIN);
  const pad = Math.max(span * FIT_PAD_RATIO, FIT_PAD_MIN);
  const lo = Math.max(0, rawMin - pad);
  const hi = rawMax + pad;
  if (hi - lo < FIT_PAD_MIN) {
    const mid = (lo + hi) / 2;
    return {
      title: Y_TITLE,
      range: [Math.max(0, mid - FIT_PAD_MIN), mid + FIT_PAD_MIN],
    };
  }
  return { title: Y_TITLE, range: [lo, hi] };
}

export function orderBumpLegendItems(): EvaluationLegendItem[] {
  return [
    {
      id: 'actual',
      labelKey: 'ttsOrder.chart.legend.actual',
      tipKey: 'ttsOrder.chart.tip.actual',
      color: ORDER_BUMP_CHART_COLORS.actual,
      swatch: 'solid',
    },
    {
      id: 'ge30',
      labelKey: 'ttsOrder.chart.legend.ge30',
      tipKey: 'ttsOrder.chart.tip.ge30',
      color: ORDER_BUMP_CHART_COLORS.ge30,
      swatch: 'dash',
    },
    {
      id: 'orderRaw',
      labelKey: 'ttsOrder.chart.legend.orderRaw',
      tipKey: 'ttsOrder.chart.tip.orderRaw',
      color: ORDER_BUMP_CHART_COLORS.orderRaw,
      swatch: 'dot',
    },
    {
      id: 'cycle',
      labelKey: 'ttsOrder.chart.legend.cycle',
      tipKey: 'ttsOrder.chart.tip.cycle',
      color: ORDER_BUMP_CHART_COLORS.orderAfter,
      swatch: 'dashdot',
    },
  ];
}
