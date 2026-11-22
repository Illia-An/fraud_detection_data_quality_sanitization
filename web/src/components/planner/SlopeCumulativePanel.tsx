/** Cumulative path panel — planning-year plan vs actual/sim (fair compare). */

import { Suspense, useCallback, useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, ToggleButton, Typography } from '@mui/material';

import { useT } from '../../i18n';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import { EvaluationLegend } from './EvaluationLegend';
import { HERO_HOVER_TEMPLATE, HERO_Y_SPIKES } from './heroChartCrosshair';
import { HERO_PX_PER_PERIOD } from './HeroSimulationChart';
import {
  buildYearBandAnnotations,
  formatSlopeTickLabels,
  inferPlanningYear,
} from './slopeAxisFormat';
import {
  asOfShapes,
  buildSlopePlotLayout,
  lastFinitePoint,
  planEndMarkerTrace,
  SLOPE_CUMULATIVE_DEFAULT_HIDDEN,
  SLOPE_CUMULATIVE_LEGEND,
  SLOPE_PANEL_MIN_HEIGHT_PX,
  SlopePlot,
  splitSeriesAtAsOf,
  type PlotlyAnnotation,
} from './slopeHeroShared';
import { useFrozenYRange, useSlopePlotBoxSize } from './useSlopePlotStableLayout';

interface SlopeCumulativePanelProps {
  layers: CumulativeSlopePlotLayers;
  yAxisTitle?: string;
}

export function SlopeCumulativePanel({
  layers,
  yAxisTitle = '5% Score',
}: SlopeCumulativePanelProps) {
  const t = useT();
  const { hostRef, plotWidth, hostHeight } = useSlopePlotBoxSize(false);
  const [legendOpen, setLegendOpen] = useState(false);
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
  const yRange = useFrozenYRange(false, fitY.range as [number, number] | undefined);
  const cutoverMonth = cutover.factEndLabel ?? cutover.lineLabel;
  const cutoverAnn = t('planner.slope.cutoverLine', { month: cutoverMonth });
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

  const eoyOutcome = useMemo(() => {
    const pt = lastFinitePoint(labels, planCumYs);
    return pt != null ? pt.value.toFixed(1) : null;
  }, [labels, planCumYs]);

  const ticktext = useMemo(() => formatSlopeTickLabels(labels), [labels]);
  const planningYear = useMemo(() => inferPlanningYear(labels), [labels]);
  const yearBands = useMemo(() => {
    if (planningYear == null) {
      return [] as PlotlyAnnotation[];
    }
    return buildYearBandAnnotations(labels, planningYear, {
      history: (year) => t('planner.slope.yearHistory', { year: String(year) }),
      planning: (year) => t('planner.slope.yearPlanning', { year: String(year) }),
    });
  }, [labels, planningYear, t]);

  const endMarker = isVisible('planCum') ? planEndMarkerTrace(labels, planCumYs) : null;

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
    ...(endMarker != null ? [endMarker] : []),
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
      <Stack
        direction="row"
        alignItems="baseline"
        spacing={1}
        sx={{ flexShrink: 0, px: 0.5, minHeight: 28 }}
      >
        <Stack
          direction="row"
          alignItems="baseline"
          spacing={0.75}
          useFlexGap
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Typography
            variant="subtitle2"
            sx={{ flexShrink: 0, fontWeight: 700, lineHeight: 1.2 }}
            noWrap
          >
            {t('planner.slope.panelCumulative')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid="slope-cumulative-meta"
            sx={{ minWidth: 0, fontSize: '0.7rem', lineHeight: 1.2 }}
            noWrap
          >
            {t('planner.slope.panelCumulativeMeta', { metric: yAxisTitle })}
          </Typography>
        </Stack>
        {eoyOutcome != null ? (
          <Typography
            variant="caption"
            data-testid="slope-cumulative-outcome"
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              color: '#1565c0',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {t('planner.slope.eoyPlan', { value: eoyOutcome })}
          </Typography>
        ) : null}
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
        <Box sx={{ flexShrink: 0, minHeight: 16 }}>
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
                annotations: [...cutoverAnnotations, ...yearBands],
                tickvals: labels,
                ticktext,
                bottomMargin: 36,
              }),
              dragmode: 'zoom',
              yaxis: {
                range: yRange,
                ticksuffix: '%',
                tickfont: { size: 10, color: '#757575' },
                gridcolor: 'rgba(0,0,0,0.08)',
                zeroline: false,
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
