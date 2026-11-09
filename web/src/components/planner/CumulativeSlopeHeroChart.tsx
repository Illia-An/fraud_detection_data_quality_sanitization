/** Network Hero for SPEC-P001 Plan / Actual / Simulation layers. */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import type { CumulativeSlopeNetworkLayers } from './cumulativeSlopeLayers';
import { EvaluationLegend, type EvaluationLegendItem } from './EvaluationLegend';
import {
  HERO_HOVER_TEMPLATE,
  HERO_HOVERLABEL,
  HERO_HOVERMODE,
  HERO_X_SPIKES,
  HERO_Y_SPIKES,
} from './heroChartCrosshair';
import { HERO_PLOT_HEIGHT_PX, HERO_PX_PER_PERIOD } from './HeroSimulationChart';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

export const CUMULATIVE_SLOPE_NETWORK_LEGEND: readonly EvaluationLegendItem[] = [
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
    id: 'cumActualSim',
    labelKey: 'planner.slope.cumActualSim',
    tipKey: 'planner.slope.tip.cumActualSim',
    color: '#616161',
    swatch: 'dot',
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
    labelKey: 'planner.hero.asOf',
    tipKey: 'planner.hero.tip.asOf',
    color: '#616161',
    swatch: 'asOf',
  },
] as const;

/** Default: hide cumulative companion until clicked (reduce overload). */
export const SLOPE_DEFAULT_HIDDEN_IDS = ['cumActualSim'] as const;

interface CumulativeSlopeHeroChartProps {
  layers: CumulativeSlopeNetworkLayers;
  yAxisTitle?: string;
}

export function CumulativeSlopeHeroChart({
  layers,
  yAxisTitle = '5% Score',
}: CumulativeSlopeHeroChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(SLOPE_DEFAULT_HIDDEN_IDS),
  );

  const toggleLegendId = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isVisible = useCallback((id: string) => !hiddenIds.has(id), [hiddenIds]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setPlotWidth(Math.max(0, Math.floor(width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { labels, planYs, actualYs, simYs, cumActualSimYs, target, asOfLabel } = layers;

  const yValues = [
    ...(isVisible('actual') ? actualYs.filter((v): v is number => v != null) : []),
    ...(isVisible('plan') ? planYs.filter((v): v is number => v != null) : []),
    ...(isVisible('simulation') ? simYs.filter((v): v is number => v != null) : []),
    ...(isVisible('cumActualSim')
      ? cumActualSimYs.filter((v): v is number => v != null)
      : []),
    ...(isVisible('target') ? [target] : []),
  ];
  const fitY = buildStoreImpactYAxis('fit', yValues.length > 0 ? yValues : [target]);
  const contentMinWidth = Math.max(labels.length, 1) * HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);

  const data = [
    ...(isVisible('actual')
      ? [
          {
            x: labels,
            y: actualYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.actual'),
            line: { color: '#212121', width: 2.5 },
            marker: { size: 7, color: '#212121' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('plan')
      ? [
          {
            x: labels,
            y: planYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.plan'),
            line: { color: '#1565c0', width: 3 },
            marker: { size: 7, color: '#1565c0' },
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
            line: { color: '#757575', width: 2.5, dash: 'dash' as const },
            marker: { size: 6, color: '#757575' },
            connectgaps: false,
            hovertemplate: HERO_HOVER_TEMPLATE,
          },
        ]
      : []),
    ...(isVisible('cumActualSim')
      ? [
          {
            x: labels,
            y: cumActualSimYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.slope.cumActualSim'),
            line: { color: '#616161', width: 2, dash: 'dot' as const },
            marker: { size: 5, color: '#616161' },
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

  const shapes = isVisible('asOf')
    ? [
        {
          type: 'line' as const,
          x0: asOfLabel,
          x1: asOfLabel,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: { color: '#616161', width: 1.5, dash: 'dash' as const },
        },
      ]
    : [];

  return (
    <Stack
      spacing={0.75}
      sx={{ height: '100%', minHeight: 0 }}
      data-testid="cumulative-slope-hero-chart"
    >
      <EvaluationLegend
        items={CUMULATIVE_SLOPE_NETWORK_LEGEND}
        testId="cumulative-slope-hero-legend"
        hiddenIds={hiddenIds}
        onToggle={toggleLegendId}
      />
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: HERO_PLOT_HEIGHT_PX,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          position: 'relative',
        }}
      >
        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: HERO_PLOT_HEIGHT_PX,
              }}
            >
              <CircularProgress size={28} />
            </Box>
          }
        >
          <Plot
            data={data}
            layout={{
              autosize: false,
              width: plotMinWidth,
              height: HERO_PLOT_HEIGHT_PX,
              margin: { l: 48, r: 16, t: 24, b: 40 },
              showlegend: false,
              hovermode: HERO_HOVERMODE,
              xaxis: {
                type: 'category',
                tickangle: -45,
                automargin: true,
                ...HERO_X_SPIKES,
              },
              yaxis: {
                title: { text: yAxisTitle },
                range: fitY.range,
                ticksuffix: '%',
                ...HERO_Y_SPIKES,
              },
              shapes,
              hoverlabel: HERO_HOVERLABEL,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: plotMinWidth, height: HERO_PLOT_HEIGHT_PX }}
            useResizeHandler={false}
          />
        </Suspense>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('planner.slope.caption')}
      </Typography>
    </Stack>
  );
}
