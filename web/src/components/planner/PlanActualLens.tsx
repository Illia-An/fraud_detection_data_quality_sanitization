import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import {
  applyDraftLastMonthToGapModel,
  buildMonitoringPlanActualGapModel,
  monitoringDeviationFill,
  type PlanActualGapModel,
  type PlanActualGapPoint,
} from '../../schemas/planActualGap';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

interface PlanActualLensProps {
  plan: FivePercentPlan;
  storeId: number;
  panel: SanitizedPanel;
  insights: PlanMonitoringInsights;
  /** Applied sandbox last-month estimate; null = accepted plan values. */
  draftLast?: number | null;
}

interface ChartLayout {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

interface PlottedPoint {
  x: number;
  y: number;
  point: PlanActualGapPoint;
}

const COMPACT_LAYOUT: ChartLayout = {
  width: 640,
  height: 140,
  padding: { top: 10, right: 16, bottom: 28, left: 40 },
};

const PLAN_STROKE = '#1565c0';
const ACTUAL_STROKE = '#2e7d32';
const CHAIN_STROKE = '#78909c';
const AS_OF_STROKE = '#9e9e9e';

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function scoreRange(model: PlanActualGapModel): { min: number; max: number } {
  const values: number[] = [];
  for (const point of model.points) {
    if (point.planned != null) values.push(point.planned);
    if (point.actual != null) values.push(point.actual);
    if (point.chain != null) values.push(point.chain);
  }
  if (!values.length) {
    return { min: 0, max: 1 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? Math.abs(max) * 0.1 || 1 : (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function xForIndex(index: number, count: number, layout: ChartLayout): number {
  const plotW = layout.width - layout.padding.left - layout.padding.right;
  if (count <= 1) {
    return layout.padding.left + plotW / 2;
  }
  return layout.padding.left + (index / (count - 1)) * plotW;
}

function yForScore(score: number, range: { min: number; max: number }, layout: ChartLayout): number {
  const plotH = layout.height - layout.padding.top - layout.padding.bottom;
  return layout.padding.top + plotH * (1 - normalize(score, range.min, range.max));
}

function plotSeries(
  model: PlanActualGapModel,
  scoreOf: (point: PlanActualGapPoint) => number | null,
  range: { min: number; max: number },
  layout: ChartLayout,
): PlottedPoint[] {
  const plotted: PlottedPoint[] = [];
  for (const [index, point] of model.points.entries()) {
    const score = scoreOf(point);
    if (score == null) continue;
    plotted.push({
      x: xForIndex(index, model.points.length, layout),
      y: yForScore(score, range, layout),
      point,
    });
  }
  return plotted;
}

function linePath(points: PlottedPoint[]): string {
  if (points.length < 2) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

/** Compact Plan vs actual lens (Angular monitoring-plan-actual-lens, hidePicker). */
export function PlanActualLens({
  plan,
  storeId,
  panel,
  insights,
  draftLast = null,
}: PlanActualLensProps) {
  const layout = COMPACT_LAYOUT;

  const model = useMemo(() => {
    const base = buildMonitoringPlanActualGapModel(plan, storeId, panel, insights);
    if (!base) return null;
    return applyDraftLastMonthToGapModel(base, draftLast, plan.direction);
  }, [plan, storeId, panel, insights, draftLast]);

  const range = useMemo(() => (model ? scoreRange(model) : { min: 0, max: 1 }), [model]);

  const plottedPlan = model ? plotSeries(model, (p) => p.planned, range, layout) : [];
  const plottedActual = model ? plotSeries(model, (p) => p.actual, range, layout) : [];
  const plottedChain = model ? plotSeries(model, (p) => p.chain, range, layout) : [];

  if (!model) {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Plan vs actual
        </Typography>
        <Typography variant="caption" color="text.secondary">
          No plan series for this store.
        </Typography>
      </Box>
    );
  }

  const mid = (range.min + range.max) / 2;
  const yTicks = [range.max, mid, range.min].map((value) => ({
    y: yForScore(value, range, layout),
    label: value.toFixed(0),
  }));

  const asOfX =
    model.asOfIndex != null ? xForIndex(model.asOfIndex, model.points.length, layout) : null;

  const gapLine =
    model.asOfIndex != null && model.plannedAtAsOf != null && model.actualAtAsOf != null
      ? {
          x: xForIndex(model.asOfIndex, model.points.length, layout),
          y1: yForScore(model.plannedAtAsOf, range, layout),
          y2: yForScore(model.actualAtAsOf, range, layout),
        }
      : null;

  const gapColor = monitoringDeviationFill(model.deviation);
  const planD = linePath(plottedPlan);
  const actualD = linePath(plottedActual);
  const chainD = linePath(plottedChain);

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Plan vs actual
      </Typography>
      <Typography variant="caption" sx={{ color: gapColor, display: 'block', mb: 0.5 }}>
        Store {model.storeId} · as of gap {formatPct(model.deviation)} (positive = better than plan)
      </Typography>
      <Box
        component="svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Plan vs actual gap"
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick.label}-${tick.y}`}>
            <line
              x1={layout.padding.left}
              y1={tick.y}
              x2={layout.width - layout.padding.right}
              y2={tick.y}
              stroke="#eceff1"
              strokeWidth={1}
            />
            <text
              x={layout.padding.left - 6}
              y={tick.y + 3}
              textAnchor="end"
              fontSize={9}
              fill="#90a4ae"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {asOfX != null && (
          <line
            x1={asOfX}
            y1={layout.padding.top}
            x2={asOfX}
            y2={layout.height - layout.padding.bottom}
            stroke={AS_OF_STROKE}
            strokeWidth={1}
            strokeDasharray="3 3"
          >
            <title>as of</title>
          </line>
        )}

        {chainD && (
          <path d={chainD} fill="none" stroke={CHAIN_STROKE} strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {plottedChain.map((p) => (
          <circle key={`c-${p.point.index}`} cx={p.x} cy={p.y} r={3} fill={CHAIN_STROKE}>
            <title>
              {p.point.label} · chain · {p.point.chain?.toFixed(1)}
            </title>
          </circle>
        ))}

        {planD && <path d={planD} fill="none" stroke={PLAN_STROKE} strokeWidth={2} />}
        {plottedPlan.map((p) => (
          <circle key={`p-${p.point.index}`} cx={p.x} cy={p.y} r={3.5} fill={PLAN_STROKE}>
            <title>
              {p.point.label} · plan · {p.point.planned?.toFixed(1)}
            </title>
          </circle>
        ))}

        {actualD && <path d={actualD} fill="none" stroke={ACTUAL_STROKE} strokeWidth={2} />}
        {plottedActual.map((p) => (
          <circle key={`a-${p.point.index}`} cx={p.x} cy={p.y} r={4} fill={ACTUAL_STROKE}>
            <title>
              {p.point.label} · actual · {p.point.actual?.toFixed(1)}
            </title>
          </circle>
        ))}

        {gapLine && (
          <>
            <line
              x1={gapLine.x}
              y1={gapLine.y1}
              x2={gapLine.x}
              y2={gapLine.y2}
              stroke={gapColor}
              strokeWidth={3}
            />
            <text
              x={gapLine.x + 6}
              y={(gapLine.y1 + gapLine.y2) / 2 + 3}
              fill={gapColor}
              fontSize={10}
              fontWeight={600}
            >
              {formatPct(model.deviation)}
            </text>
          </>
        )}

        {model.points.map((point, index) => (
          <text
            key={`x-${point.label}`}
            x={xForIndex(index, model.points.length, layout)}
            y={layout.height - 10}
            textAnchor="middle"
            fontSize={9}
            fill="#90a4ae"
          >
            {point.label}
          </text>
        ))}
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
        <LegendSwatch color={PLAN_STROKE} label="Store plan" />
        <LegendSwatch color={ACTUAL_STROKE} label="Actual" />
        <LegendSwatch color={CHAIN_STROKE} label="Chain" dashed />
        <LegendSwatch color={AS_OF_STROKE} label="as of" dashed />
      </Stack>
    </Box>
  );
}

function LegendSwatch({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box
        sx={{
          width: 14,
          height: 0,
          borderTop: dashed ? `2px dashed ${color}` : `2px solid ${color}`,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
