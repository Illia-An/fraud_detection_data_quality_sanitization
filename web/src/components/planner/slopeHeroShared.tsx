/** Shared Plotly helpers for Slope Hero dual panels. */

import { lazy } from 'react';

import type { EvaluationLegendItem } from './EvaluationLegend';
import {
  HERO_HOVERLABEL,
  HERO_HOVERMODE,
  HERO_X_SPIKES,
} from './heroChartCrosshair';

export const SlopePlot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

/** Minimum plot height inside a panel. */
export const SLOPE_PANEL_MIN_HEIGHT_PX = 140;
/** @deprecated alias — prefer SLOPE_PANEL_MIN_HEIGHT_PX. */
export const SLOPE_PANEL_HEIGHT_PX = SLOPE_PANEL_MIN_HEIGHT_PX;

export const SLOPE_CUMULATIVE_LEGEND: readonly EvaluationLegendItem[] = [
  {
    id: 'planCum',
    labelKey: 'planner.slope.planCum',
    tipKey: 'planner.slope.tip.planCum',
    color: '#1565c0',
    swatch: 'thick',
  },
  {
    id: 'cumActualSimYtd',
    labelKey: 'planner.slope.cumActualSimYtd',
    tipKey: 'planner.slope.tip.cumActualSimYtd',
    color: '#455a64',
    swatch: 'solid',
  },
  {
    id: 'cumActualSim',
    labelKey: 'planner.slope.cumActualSim',
    tipKey: 'planner.slope.tip.cumActualSim',
    color: '#9e9e9e',
    swatch: 'dashdot',
  },
  {
    id: 'requiredCumulative',
    labelKey: 'planner.slope.requiredCumulative',
    tipKey: 'planner.slope.tip.requiredCumulative',
    color: '#616161',
    swatch: 'thick',
  },
  {
    id: 'target',
    labelKey: 'planner.hero.target',
    tipKey: 'planner.hero.tip.target',
    color: '#c62828',
    swatch: 'target',
  },
  {
    id: 'asOf',
    labelKey: 'planner.slope.cutoverLegend',
    tipKey: 'planner.slope.tip.cutover',
    color: '#616161',
    swatch: 'asOf',
  },
] as const;

export const SLOPE_MONTHLY_LEGEND: readonly EvaluationLegendItem[] = [
  {
    id: 'actual',
    labelKey: 'planner.slope.actual',
    tipKey: 'planner.slope.tip.actual',
    color: '#212121',
    swatch: 'solid',
  },
  {
    id: 'plan',
    labelKey: 'planner.slope.plan',
    tipKey: 'planner.slope.tip.plan',
    color: '#1565c0',
    swatch: 'thick',
  },
  {
    id: 'simulation',
    labelKey: 'planner.slope.simulation',
    tipKey: 'planner.slope.tip.simulation',
    color: '#757575',
    swatch: 'dash',
  },
  {
    id: 'requiredMonthly',
    labelKey: 'planner.slope.requiredMonthly',
    tipKey: 'planner.slope.tip.requiredMonthly',
    color: '#424242',
    swatch: 'dash',
  },
  {
    id: 'target',
    labelKey: 'planner.hero.target',
    tipKey: 'planner.hero.tip.target',
    color: '#c62828',
    swatch: 'target',
  },
  {
    id: 'asOf',
    labelKey: 'planner.slope.cutoverLegend',
    tipKey: 'planner.slope.tip.cutover',
    color: '#616161',
    swatch: 'asOf',
  },
] as const;

/** Long-run cumulative + required path hidden by default on the cumulative panel. */
export const SLOPE_CUMULATIVE_DEFAULT_HIDDEN: readonly string[] = [
  'cumActualSim',
  'requiredCumulative',
];

/** Required monthly hidden by default on the monthly panel. */
export const SLOPE_MONTHLY_DEFAULT_HIDDEN: readonly string[] = ['requiredMonthly'];

/** Combined legend (compat re-export of both panels' items, de-duped by id). */
export const CUMULATIVE_SLOPE_NETWORK_LEGEND: readonly EvaluationLegendItem[] = (() => {
  const byId = new Map<string, EvaluationLegendItem>();
  for (const item of [...SLOPE_CUMULATIVE_LEGEND, ...SLOPE_MONTHLY_LEGEND]) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
})();

/** @deprecated use SLOPE_CUMULATIVE_DEFAULT_HIDDEN */
export const SLOPE_DEFAULT_HIDDEN_IDS = SLOPE_CUMULATIVE_DEFAULT_HIDDEN;

export function asOfShapes(
  lineLabel: string,
  visible: boolean,
  annotationText?: string | null,
) {
  if (!visible) {
    return { shapes: [], annotations: [] as PlotlyAnnotation[] };
  }
  const shapes = [
    {
      type: 'line' as const,
      x0: lineLabel,
      x1: lineLabel,
      y0: 0,
      y1: 1,
      yref: 'paper' as const,
      line: { color: '#616161', width: 1.5, dash: 'dash' as const },
    },
  ];
  const annotations: PlotlyAnnotation[] = annotationText
    ? [
        {
          x: lineLabel,
          y: 1,
          xref: 'x',
          yref: 'paper',
          text: annotationText,
          showarrow: false,
          xanchor: 'left',
          yanchor: 'bottom',
          xshift: 4,
          font: { size: 10, color: '#616161' },
        },
      ]
    : [];
  return { shapes, annotations };
}

export interface PlotlyAnnotation {
  x: string | number;
  y: number;
  xref?: string;
  yref?: string;
  text: string;
  showarrow?: boolean;
  xanchor?: string;
  yanchor?: string;
  xshift?: number;
  yshift?: number;
  font?: { size?: number; color?: string };
  bgcolor?: string;
  borderpad?: number;
}

/** Last non-null point for EOY endpoint labels. */
export function lastFinitePoint(
  labels: string[],
  values: (number | null)[],
): { label: string; value: number } | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      return { label: labels[i], value: v };
    }
  }
  return null;
}

/**
 * Split one continuous series at as-of for solid fact + dashed forecast.
 * Forecast includes the as-of point so the handoff has no visual gap.
 */
export function splitSeriesAtAsOf(
  values: (number | null)[],
  asOfIndex: number,
): { fact: (number | null)[]; forecast: (number | null)[] } {
  if (asOfIndex < 0) {
    return { fact: values.map(() => null), forecast: [...values] };
  }
  const fact = values.map((v, i) => (i <= asOfIndex ? v : null));
  const forecast = values.map((v, i) => (i >= asOfIndex ? v : null));
  return { fact, forecast };
}

export function buildSlopePlotLayout(opts: {
  plotWidth: number;
  plotHeight: number;
  shapes: ReturnType<typeof asOfShapes>['shapes'];
  annotations?: PlotlyAnnotation[];
  /** Extra top margin when cutover / EOY labels are drawn. */
  topMargin?: number;
  rightMargin?: number;
}) {
  return {
    autosize: false as const,
    width: opts.plotWidth,
    height: opts.plotHeight,
    margin: {
      l: 48,
      r: opts.rightMargin ?? 72,
      t: opts.topMargin ?? 28,
      b: 36,
    },
    showlegend: false,
    hovermode: HERO_HOVERMODE,
    xaxis: {
      type: 'category' as const,
      tickangle: -45,
      automargin: true,
      ...HERO_X_SPIKES,
    },
    shapes: opts.shapes,
    annotations: opts.annotations ?? [],
    hoverlabel: HERO_HOVERLABEL,
  };
}
