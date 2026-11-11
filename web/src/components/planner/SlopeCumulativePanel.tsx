/** Cumulative path panel — planning-year plan vs actual/sim (fair compare). */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, ToggleButton, Typography } from '@mui/material';

import { useT } from '../../i18n';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import { EvaluationLegend } from './EvaluationLegend';
import { HERO_HOVER_TEMPLATE, HERO_Y_SPIKES } from './heroChartCrosshair';
import { HERO_PX_PER_PERIOD } from './HeroSimulationChart';
import {
  asOfShapes,
  buildSlopePlotLayout,
  lastFinitePoint,
  SLOPE_CUMULATIVE_DEFAULT_HIDDEN,
  SLOPE_CUMULATIVE_LEGEND,
  SLOPE_PANEL_MIN_HEIGHT_PX,
  SlopePlot,
  splitSeriesAtAsOf,
  type PlotlyAnnotation,
} from './slopeHeroShared';

interface SlopeCumulativePanelProps {
  layers: CumulativeSlopePlotLayers;
  yAxisTitle?: string;
}

export function SlopeCumulativePanel({
  layers,
  yAxisTitle = '5% Score',
}: SlopeCumulativePanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hostHeight, setHostHeight] = useState(0);
  const [legendOpen, setLegendOpen] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(SLOPE_CUMULATIVE_DEFAULT_HIDDEN),
  );

  const toggleLegendId = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isVisible = useCallback((id: string) => !hiddenIds.has(id), [hiddenIds]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setPlotWidth(Math.max(0, Math.floor(rect.width)));
      setHostHeight(Math.max(0, Math.floor(rect.height)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const {
    labels,
    planCumYs,
    cumActualSimYs,
    cumActualSimYtdYs,
    requiredCumulativeYs,
    target,
    cutover,
  } = layers;
  const contentMinWidth = Math.max(labels.length, 1) * HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);
  const plotHeight = Math.max(SLOPE_PANEL_MIN_HEIGHT_PX, hostHeight || SLOPE_PANEL_MIN_HEIGHT_PX);

  const yValues = useMemo(
    () => [
      ...(isVisible('planCum') ? planCumYs.filter((v): v is number => v != null) : []),
      ...(isVisible('cumActualSimYtd')
        ? cumActualSimYtdYs.filter((v): v is number => v != null)
        : []),
      ...(isVisible('cumActualSim')
        ? cumActualSimYs.filter((v): v is number => v != null)
        : []),
      ...(isVisible('requiredCumulative')
        ? requiredCumulativeYs.filter((v): v is number => v != null)
        : []),
      ...(isVisible('target') ? [target] : []),
    ],
    [isVisible, planCumYs, cumActualSimYtdYs, cumActualSimYs, requiredCumulativeYs, target],
  );
  const fitY = buildStoreImpactYAxis('fit', yValues.length > 0 ? yValues : [target]);
  const cutoverAnn = t('planner.slope.cutoverLine');
  const { shapes, annotations: cutoverAnnotations } = asOfShapes(
    cutover.lineLabel,
    isVisible('asOf'),
    cutoverAnn,
  );
  // Solid/dash handoff at last plotted fact (not declared as_of when they diverge).
  const splitIdx = cutover.factEndIndex >= 0 ? cutover.factEndIndex : labels.indexOf(cutover.lineLabel);
  const ytdSplit = useMemo(
    () => splitSeriesAtAsOf(cumActualSimYtdYs, splitIdx),
    [cumActualSimYtdYs, splitIdx],
  );
  const longSplit = useMemo(
    () => splitSeriesAtAsOf(cumActualSimYs, splitIdx),
    [cumActualSimYs, splitIdx],
  );

  const eoyAnnotations = useMemo(() => {
    const out: PlotlyAnnotation[] = [];
    const fmt = (n: number) => n.toFixed(1);
    if (isVisible('planCum')) {
      const pt = lastFinitePoint(labels, planCumYs);
      if (pt) {
        out.push({
          x: pt.label,
          y: pt.value,
          text: t('planner.slope.eoyPlan', { value: fmt(pt.value) }),
          showarrow: false,
          xanchor: 'left',
          yanchor: 'middle',
          xshift: 6,
          font: { size: 10, color: '#1565c0' },
        });
      }
    }
    if (isVisible('cumActualSimYtd')) {
      const pt = lastFinitePoint(labels, cumActualSimYtdYs);
      if (pt) {
        out.push({
          x: pt.label,
          y: pt.value,
          text: t('planner.slope.eoySim', { value: fmt(pt.value) }),
          showarrow: false,
          xanchor: 'left',
          yanchor: 'top',
          xshift: 6,
          yshift: -2,
          font: { size: 10, color: '#455a64' },
        });
      }
    }
    if (isVisible('target') && labels.length > 0) {
      out.push({
        x: labels[labels.length - 1],
        y: target,
        text: t('planner.slope.eoyTarget', { value: fmt(target) }),
        showarrow: false,
        xanchor: 'left',
        yanchor: 'bottom',
        xshift: 6,
        font: { size: 10, color: '#c62828' },
      });
    }
    return out;
  }, [isVisible, labels, planCumYs, cumActualSimYtdYs, target, t]);

  const data = [
    ...(isVisible('planCum')
      ? [
          {
            x: labels,
            y: planCumYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.planCum'),
            line: { color: '#1565c0', width: 3 },
            marker: { size: 6, color: '#1565c0' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('cumActualSimYtd')
      ? [
          {
            x: labels,
            y: ytdSplit.fact,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.cumActualSimYtd'),
            legendgroup: 'cumActualSimYtd',
            line: { color: '#455a64', width: 2.5 },
            marker: { size: 5, color: '#455a64' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
          {
            x: labels,
            y: ytdSplit.forecast,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.cumActualSimYtdForecast'),
            legendgroup: 'cumActualSimYtd',
            showlegend: false,
            line: { color: '#455a64', width: 2.5, dash: 'dash' as const },
            marker: { size: 5, color: '#455a64', symbol: 'diamond' as const },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('cumActualSim')
      ? [
          {
            x: labels,
            y: longSplit.fact,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.cumActualSim'),
            legendgroup: 'cumActualSim',
            line: { color: '#9e9e9e', width: 2 },
            marker: { size: 4, color: '#9e9e9e' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
          {
            x: labels,
            y: longSplit.forecast,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.cumActualSim'),
            legendgroup: 'cumActualSim',
            showlegend: false,
            line: { color: '#9e9e9e', width: 2, dash: 'dash' as const },
            marker: { size: 4, color: '#9e9e9e' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('requiredCumulative')
      ? [
          {
            x: labels,
            y: requiredCumulativeYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.requiredCumulative'),
            line: { color: '#616161', width: 2.5 },
            marker: { size: 5, color: '#616161', symbol: 'diamond' as const },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('target')
      ? [
          {
            x: labels,
            y: labels.map(() => target),
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: t('planner.hero.target'),
            line: { color: '#c62828', width: 1.5, dash: 'dot' as const },
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
  ];

  return (
    <Stack
      spacing={0.5}
      sx={{ flex: '1 1 0', minHeight: 0, height: '100%', width: '100%' }}
      data-testid="slope-panel-cumulative"
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0, px: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {t('planner.slope.panelCumulative')}
        </Typography>
        <ToggleButton
          size="small"
          value="legend"
          selected={legendOpen}
          onChange={() => setLegendOpen((o) => !o)}
          aria-label={t('planner.slope.legendToggleAria')}
          data-testid="slope-cumulative-legend-toggle"
          sx={{ py: 0.15, px: 0.75, textTransform: 'none', fontSize: '0.7rem', lineHeight: 1.3 }}
        >
          {legendOpen ? t('planner.slope.legendHide') : t('planner.slope.legendShow')}
        </ToggleButton>
      </Stack>
      {legendOpen ? (
        <Box sx={{ flexShrink: 0 }}>
          <EvaluationLegend
            items={SLOPE_CUMULATIVE_LEGEND}
            testId="slope-cumulative-legend"
            hiddenIds={hiddenIds}
            onToggle={toggleLegendId}
          />
        </Box>
      ) : null}
      <Box
        ref={hostRef}
        sx={{ flex: 1, minHeight: SLOPE_PANEL_MIN_HEIGHT_PX, width: '100%', overflow: 'hidden' }}
      >
        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: SLOPE_PANEL_MIN_HEIGHT_PX,
              }}
            >
              <CircularProgress size={24} />
            </Box>
          }
        >
          <SlopePlot
            data={data}
            layout={{
              ...buildSlopePlotLayout({
                plotWidth: plotMinWidth,
                plotHeight,
                shapes,
                annotations: [...cutoverAnnotations, ...eoyAnnotations],
              }),
              yaxis: {
                title: { text: yAxisTitle },
                range: fitY.range,
                ticksuffix: '%',
                ...HERO_Y_SPIKES,
              },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: plotMinWidth, height: plotHeight }}
            useResizeHandler={false}
          />
        </Suspense>
      </Box>
    </Stack>
  );
}
