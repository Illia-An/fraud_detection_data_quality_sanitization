import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { FivePercentPlan } from '../../schemas/plan';
import { monitoringDeviationFill } from '../../schemas/planActualGap';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import { buildStoreHeroEvaluationSeries } from './storeHeroEvaluationSeries';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

/** Default store Hero height; dialog Inspect can pass a taller value. */
export const STORE_HERO_PLOT_HEIGHT_PX = 260;

/**
 * Min px per month — closer to Sanitization Store impact cell pitch
 * (tall plot + auto Y ticks → nearer-square grid).
 */
export const STORE_HERO_PX_PER_PERIOD = 40;

interface StoreHeroEvaluationChartProps {
  plan: FivePercentPlan;
  storeId: number;
  panel: SanitizedPanel;
  insights: PlanMonitoringInsights;
  /** Ephemeral sandbox last-month estimate; null = plan as-is. */
  draftLast?: number | null;
  /** Override plot area height (px). Used as minHeight when fillParent. */
  plotHeightPx?: number;
  /** Fill parent height (Inspect overlay layout). */
  fillParent?: boolean;
}

function formatGap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pp`;
}

/**
 * EXP: store-level Evaluation View (fact · plan · network chain · as-of).
 * Makes clawback / surplus redistribute readable per Inspected store.
 */
export function StoreHeroEvaluationChart({
  plan,
  storeId,
  panel,
  insights,
  draftLast = null,
  plotHeightPx = STORE_HERO_PLOT_HEIGHT_PX,
  fillParent = false,
}: StoreHeroEvaluationChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotHeight, setPlotHeight] = useState(plotHeightPx);
  const [plotWidth, setPlotWidth] = useState(0);

  useEffect(() => {
    if (!fillParent) {
      setPlotHeight(plotHeightPx);
    }
  }, [plotHeightPx, fillParent]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = entries[0]?.contentRect;
        if (!rect) {
          return;
        }
        if (rect.height >= 180) {
          setPlotHeight(Math.floor(rect.height));
        }
        if (rect.width > 0) {
          setPlotWidth(Math.floor(rect.width));
        }
        window.dispatchEvent(new Event('resize'));
      });
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const series = useMemo(
    () => buildStoreHeroEvaluationSeries(plan, storeId, panel, insights, draftLast),
    [plan, storeId, panel, insights, draftLast],
  );

  if (!series) {
    return (
      <Box data-testid="store-hero-evaluation-chart">
        <Typography variant="subtitle2" gutterBottom>
          {t('planner.storeHero.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('planner.storeHero.empty')}
        </Typography>
      </Box>
    );
  }

  const { labels, actualYs, planYs, chainYs, asOfLabel, deviation } = series;
  const yValues = [
    ...actualYs.filter((v): v is number => v != null),
    ...planYs.filter((v): v is number => v != null),
    ...chainYs.filter((v): v is number => v != null),
  ];
  /** Same fit-scale helper as Sanitization Store impact (auto Y ticks, no dtick:1). */
  const fitY = buildStoreImpactYAxis('fit', yValues);
  const yMin = fitY.range?.[0] ?? 0;
  const yMax = fitY.range?.[1] ?? 100;
  const contentMinWidth = Math.max(labels.length, 1) * STORE_HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);
  const gapColor = monitoringDeviationFill(deviation);
  const hoverPct = '%{x}<br>%{fullData.name}: %{y:.2f}%<extra></extra>';

  const data = [
    {
      x: labels,
      y: chainYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: t('planner.storeHero.chain'),
      line: { color: '#78909c', width: 1.5, dash: 'dash' as const },
      marker: { size: 5, color: '#78909c' },
      connectgaps: false,
      hovertemplate: hoverPct,
    },
    {
      x: labels,
      y: actualYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: t('planner.storeHero.actual'),
      line: { color: '#212121', width: 2.5 },
      marker: { size: 7, color: '#212121' },
      connectgaps: false,
      hovertemplate: hoverPct,
    },
    {
      x: labels,
      y: planYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: t('planner.storeHero.plan'),
      line: { color: '#1565c0', width: 3 },
      marker: { size: 7, color: '#1565c0' },
      connectgaps: false,
      hovertemplate: hoverPct,
    },
  ];

  const shapes =
    asOfLabel != null
      ? [
          {
            type: 'line' as const,
            x0: asOfLabel,
            x1: asOfLabel,
            y0: yMin,
            y1: yMax,
            line: { color: '#9e9e9e', width: 1, dash: 'dot' as const },
          },
        ]
      : [];

  const annotations =
    asOfLabel != null
      ? [
          {
            x: asOfLabel,
            y: yMax,
            text: t('planner.storeHero.asOf'),
            showarrow: false,
            yanchor: 'bottom' as const,
            font: { size: 10, color: '#757575' },
          },
        ]
      : [];

  return (
    <Stack
      spacing={0.35}
      data-testid="store-hero-evaluation-chart"
      sx={fillParent ? { flex: 1, minHeight: 0, height: '100%' } : undefined}
    >
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        spacing={0.75}
        sx={{ minWidth: 0, columnGap: 1, rowGap: 0.25, flexShrink: 0 }}
      >
        <Typography
          component="span"
          sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2, flexShrink: 0 }}
        >
          {t('planner.storeHero.title')}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2, color: gapColor, flexShrink: 0 }}
        >
          {t('planner.storeHero.gapCaption', {
            id: storeId,
            gap: formatGap(deviation),
          })}
        </Typography>
        <Typography
          component="span"
          color="text.secondary"
          sx={{
            fontSize: '0.65rem',
            lineHeight: 1.2,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: { xs: 'normal', md: 'nowrap' },
          }}
        >
          {t('planner.storeHero.hint')}
        </Typography>
      </Stack>
      <Box
        ref={containerRef}
        sx={{
          height: fillParent ? '100%' : plotHeightPx,
          minHeight: fillParent ? plotHeightPx : undefined,
          flex: fillParent ? 1 : undefined,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          position: 'relative',
          isolation: 'isolate',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'grey.50',
        }}
      >
        <Box sx={{ minWidth: plotMinWidth, width: '100%', height: '100%' }}>
          <Suspense
            fallback={
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={24} />
              </Box>
            }
          >
            <Plot
              data={data}
              layout={{
                autosize: true,
                height: plotHeight,
                width: plotMinWidth > 0 ? plotMinWidth : undefined,
                margin: { l: 44, r: 12, t: 24, b: 36 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                dragmode: 'zoom',
                legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 10 } },
                xaxis: {
                  title: { text: '' },
                  tickangle: -30,
                  automargin: true,
                  showgrid: true,
                  gridcolor: 'rgba(0, 0, 0, 0.06)',
                  zeroline: false,
                },
                yaxis: {
                  title: { text: '5%' },
                  range: [yMin, yMax],
                  ticksuffix: '%',
                  fixedrange: false,
                  showgrid: true,
                  gridcolor: 'rgba(0, 0, 0, 0.08)',
                  zeroline: false,
                },
                shapes,
                annotations,
              }}
              config={{
                displayModeBar: true,
                displaylogo: false,
                responsive: true,
                scrollZoom: true,
                modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
              }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
            />
          </Suspense>
        </Box>
      </Box>
    </Stack>
  );
}
