/** Monthly levels panel — fact · plan · simulation forecast. */

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
  SLOPE_MONTHLY_DEFAULT_HIDDEN,
  SLOPE_MONTHLY_LEGEND,
  SLOPE_PANEL_MIN_HEIGHT_PX,
  SlopePlot,
} from './slopeHeroShared';

interface SlopeMonthlyPanelProps {
  layers: CumulativeSlopePlotLayers;
  yAxisTitle?: string;
}

export function SlopeMonthlyPanel({
  layers,
  yAxisTitle = '5% Score',
}: SlopeMonthlyPanelProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hostHeight, setHostHeight] = useState(0);
  const [legendOpen, setLegendOpen] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(SLOPE_MONTHLY_DEFAULT_HIDDEN),
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

  const { labels, planYs, actualYs, simYs, requiredMonthlyYs, target, cutover } = layers;
  const contentMinWidth = Math.max(labels.length, 1) * HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);
  const plotHeight = Math.max(SLOPE_PANEL_MIN_HEIGHT_PX, hostHeight || SLOPE_PANEL_MIN_HEIGHT_PX);
  const factEndIdx = cutover.factEndIndex;

  // Past plan muted (context); future plan full blue from last fact handoff.
  const planPastYs = useMemo(
    () =>
      planYs.map((v, i) => (factEndIdx >= 0 && i <= factEndIdx ? v : null)),
    [planYs, factEndIdx],
  );
  const planFutureYs = useMemo(
    () =>
      planYs.map((v, i) => (factEndIdx < 0 || i >= factEndIdx ? v : null)),
    [planYs, factEndIdx],
  );
  const lastFactPoint =
    factEndIdx >= 0 && actualYs[factEndIdx] != null
      ? { x: labels[factEndIdx], y: actualYs[factEndIdx] as number }
      : null;

  const yValues = useMemo(
    () => [
      ...(isVisible('actual') ? actualYs.filter((v): v is number => v != null) : []),
      ...(isVisible('plan') ? planYs.filter((v): v is number => v != null) : []),
      ...(isVisible('simulation') ? simYs.filter((v): v is number => v != null) : []),
      ...(isVisible('requiredMonthly')
        ? requiredMonthlyYs.filter((v): v is number => v != null)
        : []),
      ...(isVisible('target') ? [target] : []),
    ],
    [isVisible, actualYs, planYs, simYs, requiredMonthlyYs, target],
  );
  const fitY = buildStoreImpactYAxis('fit', yValues.length > 0 ? yValues : [target]);
  const { shapes, annotations } = asOfShapes(
    cutover.lineLabel,
    isVisible('asOf'),
    t('planner.slope.cutoverLine'),
  );

  // Fact = black; plan future = blue; sim = grey dash + diamond (readable when values overlap).
  const data = [
    ...(isVisible('actual')
      ? [
          {
            x: labels,
            y: actualYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.actual'),
            line: { color: '#212121', width: 1.5 },
            marker: { size: 8, color: '#212121' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('actual') && lastFactPoint
      ? [
          {
            x: [lastFactPoint.x],
            y: [lastFactPoint.y],
            type: 'scatter' as const,
            mode: 'markers' as const,
            name: t('planner.slope.lastFact'),
            marker: {
              size: 14,
              color: '#212121',
              symbol: 'circle' as const,
              line: { width: 2.5, color: '#ffffff' },
            },
            hovertemplate: HERO_HOVER_TEMPLATE,
            showlegend: false,
          },
        ]
      : []),
    ...(isVisible('plan')
      ? [
          {
            x: labels,
            y: planPastYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.plan'),
            legendgroup: 'plan',
            line: { color: '#90caf9', width: 1.25 },
            marker: { size: 5, color: '#90caf9' },
            opacity: 0.55,
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
            showlegend: false,
          },
          {
            x: labels,
            y: planFutureYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.plan'),
            legendgroup: 'plan',
            line: { color: '#1565c0', width: 2 },
            marker: { size: 8, color: '#1565c0', symbol: 'circle' as const },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('simulation')
      ? [
          {
            x: labels,
            y: simYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.simulation'),
            line: { color: '#616161', width: 2.25, dash: 'dash' as const },
            marker: {
              size: 10,
              color: '#ffffff',
              symbol: 'diamond' as const,
              line: { width: 2, color: '#616161' },
            },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('requiredMonthly')
      ? [
          {
            x: labels,
            y: requiredMonthlyYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.requiredMonthly'),
            line: { color: '#424242', width: 2, dash: 'dash' as const },
            marker: { size: 6, color: '#424242', symbol: 'diamond' as const },
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
      data-testid="slope-panel-monthly"
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0, px: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {t('planner.slope.panelMonthly')}
        </Typography>
        <ToggleButton
          size="small"
          value="legend"
          selected={legendOpen}
          onChange={() => setLegendOpen((o) => !o)}
          aria-label={t('planner.slope.legendToggleAria')}
          data-testid="slope-monthly-legend-toggle"
          sx={{ py: 0.15, px: 0.75, textTransform: 'none', fontSize: '0.7rem', lineHeight: 1.3 }}
        >
          {legendOpen ? t('planner.slope.legendHide') : t('planner.slope.legendShow')}
        </ToggleButton>
      </Stack>
      {legendOpen ? (
        <Box sx={{ flexShrink: 0 }}>
          <EvaluationLegend
            items={SLOPE_MONTHLY_LEGEND}
            testId="slope-monthly-legend"
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
                annotations,
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
