import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  Box,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { useT } from '../../i18n';
import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import {
  EvaluationLegend,
  HERO_EVALUATION_LEGEND,
  HERO_PRESSURE_LEGEND,
} from './EvaluationLegend';
import {
  asOfHorizontalShape,
  HERO_HOVER_TEMPLATE,
  HERO_HOVERLABEL,
  HERO_HOVERMODE,
  HERO_X_SPIKES,
  HERO_Y_SPIKES,
} from './heroChartCrosshair';
import { buildHeroEvaluationSeries } from './heroEvaluationSeries';
import {
  buildPressureRequiredPair,
  planTargetMonthLabel,
  type HeroRequiredMode,
} from './pressureEvaluationSeries';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

/** Datadog Evaluation View — fixed hero height (~340px plot). */
export const HERO_PLOT_HEIGHT_PX = 340;

/**
 * Min px per month — closer to Sanitization Store impact cell pitch
 * (auto Y ticks → nearer-square grid vs previous dtick:1 rectangles).
 */
export const HERO_PX_PER_PERIOD = 44;

interface HeroSimulationChartProps {
  draftPlan: DirectedPlan;
  panel: MetricScorePanel;
  asOfYear: number;
  asOfMonth: number;
  /** Soft envelope half-width; not a statistical CI. Percent points for 5%, minutes for TTS. */
  slackBandPp?: number;
  /** Y-axis title. Default keeps the 5% planner label. */
  yAxisTitle?: string;
  /** Appended to tick labels. Default `%`. */
  tickSuffix?: string;
  scoreFloor?: number;
  scoreCeiling?: number;
}

/** Dual-trace Evaluation View: cleansed fact | as-of | forecast cone + target. */
export function HeroSimulationChart({
  draftPlan,
  panel,
  asOfYear,
  asOfMonth,
  slackBandPp = 1.5,
  yAxisTitle = '5% Score',
  tickSuffix = '%',
  scoreFloor = 0,
  scoreCeiling = 100,
}: HeroSimulationChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotHeight, setPlotHeight] = useState(HERO_PLOT_HEIGHT_PX);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [requiredMode, setRequiredMode] = useState<HeroRequiredMode>('plan');
  const isPressure = requiredMode === 'pressure';

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

  const handleRequiredMode = useCallback(
    (_event: MouseEvent<HTMLElement>, next: HeroRequiredMode | null) => {
      if (next == null) {
        return;
      }
      setRequiredMode(next);
      setHiddenIds(new Set());
    },
    [],
  );

  const isVisible = useCallback((id: string) => !hiddenIds.has(id), [hiddenIds]);

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
        const nextH = Math.floor(rect.height);
        const nextW = Math.floor(rect.width);
        // Drive Plot size via props only — do not fake window.resize (Plotly feedback loop).
        if (nextH >= 200) {
          setPlotHeight((prev) => (prev === nextH ? prev : nextH));
        }
        if (nextW > 0) {
          setPlotWidth((prev) => (prev === nextW ? prev : nextW));
        }
      });
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const series = useMemo(
    () =>
      buildHeroEvaluationSeries(
        draftPlan,
        panel,
        { year: asOfYear, month: asOfMonth },
        slackBandPp,
        { floor: scoreFloor, ceiling: scoreCeiling },
      ),
    [draftPlan, panel, asOfYear, asOfMonth, slackBandPp, scoreFloor, scoreCeiling],
  );

  const pressurePair = useMemo(() => {
    const horizonEnd = planTargetMonthLabel(draftPlan);
    return buildPressureRequiredPair(
      series.labels,
      series.factYs,
      series.target,
      asOfYear,
      horizonEnd,
    );
  }, [draftPlan, series.labels, series.factYs, series.target, asOfYear]);

  const {
    labels,
    factYs,
    cumulativeYs,
    windowCumulativeYs,
    planCumulativeYs,
    draftYs,
    upperYs,
    lowerYs,
    target,
    asOfLabel,
    windowStartLabel,
  } = series;

  const requiredMonthlyYs = isPressure
    ? pressurePair.requiredMonthlyYs
    : series.requiredMonthlyYs;
  const requiredCumulativeYs = isPressure
    ? pressurePair.requiredCumulativeYs
    : series.requiredCumulativeYs;
  const yearStartLabel = pressurePair.yearStartLabel;
  const lastFactLabel = pressurePair.lastFactLabel;
  const horizonEndLabel = pressurePair.horizonEndLabel;
  const legendItems = isPressure ? HERO_PRESSURE_LEGEND : HERO_EVALUATION_LEGEND;

  const yValues = [
    ...(isVisible('fact') ? factYs.filter((v): v is number => v != null) : []),
    ...(isVisible('cumulative')
      ? cumulativeYs.filter((v): v is number => v != null)
      : []),
    ...(!isPressure && isVisible('windowCumulative')
      ? windowCumulativeYs.filter((v): v is number => v != null)
      : []),
    ...(!isPressure && isVisible('planCumulative')
      ? planCumulativeYs.filter((v): v is number => v != null)
      : []),
    ...(!isPressure && isVisible('draft')
      ? draftYs.filter((v): v is number => v != null)
      : []),
    ...(isVisible('requiredMonthly')
      ? requiredMonthlyYs.filter((v): v is number => v != null)
      : []),
    ...(isVisible('requiredCumulative')
      ? requiredCumulativeYs.filter((v): v is number => v != null)
      : []),
    ...(!isPressure && isVisible('cone')
      ? [
          ...upperYs.filter((v): v is number => v != null),
          ...lowerYs.filter((v): v is number => v != null),
        ]
      : []),
    ...(isVisible('target') ? [target] : []),
  ];
  /** Same fit-scale helper as Sanitization Store impact (auto Y ticks, no dtick:1). */
  const fitY = buildStoreImpactYAxis('fit', yValues.length > 0 ? yValues : [target]);
  const yMin = fitY.range?.[0] ?? 0;
  const yMax = fitY.range?.[1] ?? 100;
  // Stretch series across the full component width; scroll only if months need more room.
  const contentMinWidth = Math.max(labels.length, 1) * HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);

  const hoverPct =
    tickSuffix === '%' ? HERO_HOVER_TEMPLATE : `%{y:.2f}${tickSuffix}<extra></extra>`;

  const requiredMonthlyName = isPressure
    ? t('planner.hero.pressureMonthly')
    : t('planner.hero.requiredMonthly');
  const requiredCumulativeName = isPressure
    ? t('planner.hero.pressureCumulative')
    : t('planner.hero.requiredCumulative');

  const data = [
    ...(!isPressure && isVisible('cone')
      ? [
          {
            x: labels,
            y: upperYs,
            type: 'scatter' as const,
            mode: 'lines' as const,
            line: { width: 0 },
            marker: { color: 'rgba(25, 118, 210, 0.15)' },
            name: t('planner.hero.cone'),
            showlegend: false,
            hoverinfo: 'skip' as const,
            connectgaps: false,
          },
          {
            x: labels,
            y: lowerYs,
            type: 'scatter' as const,
            mode: 'lines' as const,
            line: { width: 0 },
            fill: 'tonexty' as const,
            fillcolor: 'rgba(25, 118, 210, 0.12)',
            name: t('planner.hero.coneSlack'),
            hoverinfo: 'skip' as const,
            connectgaps: false,
          },
        ]
      : []),
    ...(isVisible('fact')
      ? [
          {
            x: labels,
            y: factYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.hero.fact'),
            line: { color: '#212121', width: 2.5 },
            marker: { size: 7, color: '#212121' },
            connectgaps: false,
            hovertemplate: hoverPct,
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
            name: requiredMonthlyName,
            line: { color: '#424242', width: 2, dash: 'dash' as const },
            marker: { size: 6, color: '#424242', symbol: 'diamond' as const },
            connectgaps: false,
            hovertemplate: hoverPct,
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
            name: requiredCumulativeName,
            line: { color: '#616161', width: 2.5 },
            marker: { size: 6, color: '#616161', symbol: 'diamond' as const },
            connectgaps: false,
            hovertemplate: hoverPct,
          },
        ]
      : []),
    ...(isVisible('cumulative')
      ? [
          {
            x: labels,
            y: cumulativeYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.hero.cumulative'),
            line: { color: '#6a1b9a', width: 2, dash: 'dashdot' as const },
            marker: { size: 6, color: '#6a1b9a' },
            connectgaps: false,
            hovertemplate: hoverPct,
          },
        ]
      : []),
    ...(!isPressure && isVisible('windowCumulative')
      ? [
          {
            x: labels,
            y: windowCumulativeYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.hero.windowCumulative'),
            line: { color: '#ef6c00', width: 2, dash: 'dash' as const },
            marker: { size: 6, color: '#ef6c00' },
            connectgaps: false,
            hovertemplate: hoverPct,
          },
        ]
      : []),
    ...(!isPressure && isVisible('planCumulative')
      ? [
          {
            x: labels,
            y: planCumulativeYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.hero.planCumulative'),
            line: { color: '#2e7d32', width: 2, dash: 'dot' as const },
            marker: { size: 6, color: '#2e7d32' },
            connectgaps: false,
            hovertemplate: hoverPct,
          },
        ]
      : []),
    ...(!isPressure && isVisible('draft')
      ? [
          {
            x: labels,
            y: draftYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.hero.draft'),
            line: { color: '#1565c0', width: 3 },
            marker: { size: 7, color: '#1565c0' },
            connectgaps: false,
            hovertemplate: hoverPct,
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
            hovertemplate: hoverPct,
          },
        ]
      : []),
  ];

  const cutoverLabel = isPressure ? lastFactLabel : asOfLabel;
  const cutoverIdx = cutoverLabel != null ? labels.indexOf(cutoverLabel) : -1;
  const cutoverCrosshairY =
    cutoverIdx >= 0
      ? (requiredCumulativeYs[cutoverIdx] ??
        (!isPressure ? windowCumulativeYs[cutoverIdx] : null) ??
        factYs[cutoverIdx] ??
        null)
      : null;

  const yearStartOnAxis = labels.includes(yearStartLabel);

  const shapes = [
    ...(!isPressure && isVisible('windowHandoff')
      ? [
          {
            type: 'line' as const,
            x0: windowStartLabel,
            x1: windowStartLabel,
            y0: 0,
            y1: 1,
            yref: 'paper' as const,
            line: { color: '#9e9e9e', width: 1.5, dash: 'dot' as const },
          },
        ]
      : []),
    ...(isPressure && isVisible('yearStart') && yearStartOnAxis
      ? [
          {
            type: 'line' as const,
            x0: yearStartLabel,
            x1: yearStartLabel,
            y0: 0,
            y1: 1,
            yref: 'paper' as const,
            line: { color: '#9e9e9e', width: 1.5, dash: 'dot' as const },
          },
        ]
      : []),
    ...((!isPressure && isVisible('asOf')) ||
    (isPressure && isVisible('lastFact') && lastFactLabel != null)
      ? [
          {
            type: 'line' as const,
            x0: cutoverLabel!,
            x1: cutoverLabel!,
            y0: 0,
            y1: 1,
            yref: 'paper' as const,
            line: { color: '#616161', width: 1.5, dash: 'dash' as const },
          },
          ...(cutoverCrosshairY != null
            ? [asOfHorizontalShape(cutoverCrosshairY, '#616161')]
            : []),
        ]
      : []),
  ];

  const annotations = [
    ...(!isPressure && isVisible('windowHandoff')
      ? [
          {
            x: windowStartLabel,
            y: 1,
            yref: 'paper' as const,
            text: t('planner.hero.windowHandoff'),
            showarrow: false,
            xanchor: 'left' as const,
            yanchor: 'bottom' as const,
            font: { size: 11, color: '#9e9e9e' },
            xshift: 4,
          },
        ]
      : []),
    ...(isPressure && isVisible('yearStart') && yearStartOnAxis
      ? [
          {
            x: yearStartLabel,
            y: 1,
            yref: 'paper' as const,
            text: t('planner.hero.yearStart'),
            showarrow: false,
            xanchor: 'left' as const,
            yanchor: 'bottom' as const,
            font: { size: 11, color: '#9e9e9e' },
            xshift: 4,
          },
        ]
      : []),
    ...(!isPressure && isVisible('asOf')
      ? [
          {
            x: asOfLabel,
            y: 1,
            yref: 'paper' as const,
            text: t('planner.hero.asOf'),
            showarrow: false,
            xanchor: 'left' as const,
            yanchor: 'bottom' as const,
            font: { size: 11, color: '#616161' },
            xshift: 4,
          },
        ]
      : []),
    ...(isPressure && isVisible('lastFact') && lastFactLabel != null
      ? [
          {
            x: lastFactLabel,
            y: 1,
            yref: 'paper' as const,
            text: t('planner.hero.lastFact'),
            showarrow: false,
            xanchor: 'left' as const,
            yanchor: 'bottom' as const,
            font: { size: 11, color: '#616161' },
            xshift: 4,
          },
        ]
      : []),
  ];

  return (
    <Stack
      spacing={0.75}
      sx={{ height: '100%', minHeight: 0 }}
      data-testid="hero-evaluation-chart"
      data-required-mode={requiredMode}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ flexShrink: 0 }}
      >
        <EvaluationLegend
          items={legendItems}
          testId="hero-evaluation-legend"
          hiddenIds={hiddenIds}
          onToggle={toggleLegendId}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={requiredMode}
          onChange={handleRequiredMode}
          aria-label={t('planner.hero.modeAria')}
          data-testid="hero-required-mode"
        >
          <ToggleButton value="plan" aria-label={t('planner.hero.modePlanAria')}>
            {t('planner.hero.modePlan')}
          </ToggleButton>
          <ToggleButton
            value="pressure"
            aria-label={t('planner.hero.modePressureAria')}
          >
            {t('planner.hero.modePressure')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: HERO_PLOT_HEIGHT_PX,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          position: 'relative',
          isolation: 'isolate',
        }}
      >
        <Box sx={{ minWidth: plotMinWidth, width: '100%', height: '100%' }}>
          <Suspense
            fallback={
              <Box
                sx={{
                  height: '100%',
                  minHeight: HERO_PLOT_HEIGHT_PX,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={28} />
              </Box>
            }
          >
            <Plot
              data={data}
              layout={{
                autosize: true,
                height: plotHeight,
                width: plotMinWidth > 0 ? plotMinWidth : undefined,
                margin: { l: 48, r: 16, t: 20, b: 40 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                dragmode: 'zoom',
                hovermode: HERO_HOVERMODE,
                hoverlabel: HERO_HOVERLABEL,
                showlegend: false,
                xaxis: {
                  title: { text: '' },
                  tickangle: -30,
                  automargin: true,
                  fixedrange: false,
                  showgrid: true,
                  gridcolor: 'rgba(0, 0, 0, 0.06)',
                  zeroline: false,
                  ...HERO_X_SPIKES,
                },
                yaxis: {
                  title: { text: yAxisTitle },
                  range: [yMin, yMax],
                  ticksuffix: tickSuffix,
                  fixedrange: false,
                  showgrid: true,
                  gridcolor: 'rgba(0, 0, 0, 0.08)',
                  zeroline: false,
                  ...HERO_Y_SPIKES,
                },
                shapes,
                annotations,
              }}
              config={{
                responsive: false,
                scrollZoom: true,
                displaylogo: false,
                displayModeBar: 'hover',
                modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
              }}
              style={{ width: plotMinWidth || '100%', height: plotHeight }}
              useResizeHandler
            />
          </Suspense>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {isPressure
          ? t(
              tickSuffix === '%'
                ? 'planner.hero.captionPressure'
                : 'planner.hero.captionPressureMin',
              {
                yearStart: yearStartLabel,
                lastFact: lastFactLabel ?? '—',
                horizonEnd: horizonEndLabel ?? '—',
                target:
                  tickSuffix === '%' ? String(target) : `${target.toFixed(2)} min`,
              },
            )
          : t(tickSuffix === '%' ? 'planner.hero.caption' : 'planner.hero.captionMin', {
              asOf: asOfLabel,
              slack: slackBandPp.toFixed(1),
            })}
      </Typography>
    </Stack>
  );
}
