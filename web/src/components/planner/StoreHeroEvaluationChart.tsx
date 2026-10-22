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
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { buildStoreImpactYAxis } from '../charts/storeImpactChartData';
import {
  EvaluationLegend,
  STORE_EVALUATION_LEGEND,
  STORE_PRESSURE_LEGEND,
} from './EvaluationLegend';
import {
  asOfHorizontalShape,
  HERO_HOVER_TEMPLATE,
  HERO_HOVERLABEL,
  HERO_HOVERMODE,
  HERO_X_SPIKES,
  HERO_Y_SPIKES,
} from './heroChartCrosshair';
import {
  buildPressureRequiredPair,
  planTargetMonthLabel,
  type HeroRequiredMode,
} from './pressureEvaluationSeries';
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
  plan: DirectedPlan;
  storeId: number;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  /** Ephemeral sandbox last-month estimate; null = plan as-is. */
  draftLast?: number | null;
  /** Override plot area height (px). Used as minHeight when fillParent. */
  plotHeightPx?: number;
  /** Fill parent height (Inspect overlay layout). */
  fillParent?: boolean;
  /** Y-axis title. Default keeps the 5% planner label. */
  yAxisTitle?: string;
  /** Appended to tick labels. Default `%`. */
  tickSuffix?: string;
}

/**
 * Store-level Evaluation View — same grammar as network Hero (fact · cumulative · plan · as-of).
 * Plan (−3) and Pressure (YTD) modes mirror Network Hero; gap snapshot stays in Inspect strip.
 */
export function StoreHeroEvaluationChart({
  plan,
  storeId,
  panel,
  insights,
  draftLast = null,
  plotHeightPx = STORE_HERO_PLOT_HEIGHT_PX,
  fillParent = false,
  yAxisTitle = '5%',
  tickSuffix = '%',
}: StoreHeroEvaluationChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotHeight, setPlotHeight] = useState(plotHeightPx);
  const [plotWidth, setPlotWidth] = useState(0);
  const [requiredMode, setRequiredMode] = useState<HeroRequiredMode>('plan');
  const isPressure = requiredMode === 'pressure';

  const handleRequiredMode = useCallback(
    (_event: MouseEvent<HTMLElement>, next: HeroRequiredMode | null) => {
      if (next == null) {
        return;
      }
      setRequiredMode(next);
    },
    [],
  );

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
        const nextH = Math.floor(rect.height);
        const nextW = Math.floor(rect.width);
        // Drive Plot size via props only — do not fake window.resize (Plotly feedback loop).
        if (nextH >= 180) {
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
    () => buildStoreHeroEvaluationSeries(plan, storeId, panel, insights, draftLast),
    [plan, storeId, panel, insights, draftLast],
  );

  const pressurePair = useMemo(() => {
    if (!series) {
      return null;
    }
    return buildPressureRequiredPair(
      series.labels,
      series.actualYs,
      series.target,
      insights.as_of_year,
      planTargetMonthLabel(plan),
    );
  }, [series, insights.as_of_year, plan]);

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

  const {
    labels,
    actualYs,
    planYs,
    cumulativeYs,
    planCumulativeYs,
    target,
    asOfLabel,
    asOfIndex,
  } = series;

  const requiredMonthlyYs = isPressure
    ? (pressurePair?.requiredMonthlyYs ?? series.requiredMonthlyYs)
    : series.requiredMonthlyYs;
  const requiredCumulativeYs = isPressure
    ? (pressurePair?.requiredCumulativeYs ?? series.requiredCumulativeYs)
    : series.requiredCumulativeYs;
  const yearStartLabel = pressurePair?.yearStartLabel ?? null;
  const lastFactLabel = pressurePair?.lastFactLabel ?? null;
  const horizonEndLabel = pressurePair?.horizonEndLabel ?? null;
  const legendItems = isPressure ? STORE_PRESSURE_LEGEND : STORE_EVALUATION_LEGEND;

  const yValues = [
    ...actualYs.filter((v): v is number => v != null),
    ...(!isPressure ? planYs.filter((v): v is number => v != null) : []),
    ...cumulativeYs.filter((v): v is number => v != null),
    ...(!isPressure ? planCumulativeYs.filter((v): v is number => v != null) : []),
    ...requiredMonthlyYs.filter((v): v is number => v != null),
    ...requiredCumulativeYs.filter((v): v is number => v != null),
    target,
  ];
  /** Same fit-scale helper as Sanitization Store impact (auto Y ticks, no dtick:1). */
  const fitY = buildStoreImpactYAxis('fit', yValues);
  const yMin = fitY.range?.[0] ?? 0;
  const yMax = fitY.range?.[1] ?? 100;
  const contentMinWidth = Math.max(labels.length, 1) * STORE_HERO_PX_PER_PERIOD;
  const plotMinWidth = Math.max(contentMinWidth, plotWidth || contentMinWidth);

  const hoverTemplate =
    tickSuffix === '%' ? HERO_HOVER_TEMPLATE : `%{y:.2f}${tickSuffix}<extra></extra>`;

  const requiredMonthlyName = isPressure
    ? t('planner.hero.pressureMonthly')
    : t('planner.hero.requiredMonthly');
  const requiredCumulativeName = isPressure
    ? t('planner.hero.pressureCumulative')
    : t('planner.hero.requiredCumulative');

  const data = [
    {
      x: labels,
      y: actualYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: t('planner.storeHero.actual'),
      line: { color: '#212121', width: 2.5 },
      marker: { size: 7, color: '#212121' },
      connectgaps: false,
      hovertemplate: hoverTemplate,
    },
    {
      x: labels,
      y: requiredMonthlyYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: requiredMonthlyName,
      line: { color: '#424242', width: 2, dash: 'dash' as const },
      marker: { size: 6, color: '#424242', symbol: 'diamond' as const },
      connectgaps: false,
      hovertemplate: hoverTemplate,
    },
    {
      x: labels,
      y: requiredCumulativeYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: requiredCumulativeName,
      line: { color: '#616161', width: 2.5 },
      marker: { size: 6, color: '#616161', symbol: 'diamond' as const },
      connectgaps: false,
      hovertemplate: hoverTemplate,
    },
    {
      x: labels,
      y: cumulativeYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: t('planner.storeHero.cumulative'),
      line: { color: '#6a1b9a', width: 2, dash: 'dashdot' as const },
      marker: { size: 6, color: '#6a1b9a' },
      connectgaps: false,
      hovertemplate: hoverTemplate,
    },
    ...(!isPressure
      ? [
          {
            x: labels,
            y: planCumulativeYs,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: t('planner.storeHero.planCumulative'),
            line: { color: '#2e7d32', width: 2, dash: 'dot' as const },
            marker: { size: 6, color: '#2e7d32' },
            connectgaps: false,
            hovertemplate: hoverTemplate,
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
            hovertemplate: hoverTemplate,
          },
        ]
      : []),
    {
      x: labels,
      y: labels.map(() => target),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: t('planner.storeHero.target'),
      line: { color: '#c62828', width: 1.5, dash: 'dot' as const },
      hovertemplate: hoverTemplate,
    },
  ];

  const cutoverLabel = isPressure ? lastFactLabel : asOfLabel;
  const cutoverIdx = isPressure
    ? lastFactLabel != null
      ? labels.indexOf(lastFactLabel)
      : -1
    : asOfIndex;
  const cutoverCrosshairY =
    cutoverIdx != null && cutoverIdx >= 0
      ? (requiredCumulativeYs[cutoverIdx] ??
        (!isPressure ? planCumulativeYs[cutoverIdx] : null) ??
        cumulativeYs[cutoverIdx] ??
        actualYs[cutoverIdx] ??
        null)
      : null;

  const yearStartOnAxis =
    yearStartLabel != null && labels.includes(yearStartLabel);

  const shapes = [
    ...(isPressure && yearStartOnAxis && yearStartLabel != null
      ? [
          {
            type: 'line' as const,
            x0: yearStartLabel,
            x1: yearStartLabel,
            y0: yMin,
            y1: yMax,
            line: { color: '#bdbdbd', width: 1, dash: 'dot' as const },
          },
        ]
      : []),
    ...(cutoverLabel != null
      ? [
          {
            type: 'line' as const,
            x0: cutoverLabel,
            x1: cutoverLabel,
            y0: yMin,
            y1: yMax,
            line: {
              color: isPressure ? '#616161' : '#9e9e9e',
              width: 1,
              dash: 'dot' as const,
            },
          },
          ...(cutoverCrosshairY != null
            ? [
                asOfHorizontalShape(
                  cutoverCrosshairY,
                  isPressure ? '#616161' : '#9e9e9e',
                ),
              ]
            : []),
        ]
      : []),
  ];

  const annotations = [
    ...(isPressure && yearStartOnAxis && yearStartLabel != null
      ? [
          {
            x: yearStartLabel,
            y: yMax,
            text: t('planner.hero.yearStart'),
            showarrow: false,
            yanchor: 'bottom' as const,
            font: { size: 10, color: '#9e9e9e' },
          },
        ]
      : []),
    ...(cutoverLabel != null
      ? [
          {
            x: cutoverLabel,
            y: yMax,
            text: isPressure
              ? t('planner.hero.lastFact')
              : t('planner.storeHero.asOf'),
            showarrow: false,
            yanchor: 'bottom' as const,
            font: {
              size: 10,
              color: isPressure ? '#616161' : '#757575',
            },
          },
        ]
      : []),
  ];

  return (
    <Stack
      spacing={0.35}
      data-testid="store-hero-evaluation-chart"
      data-required-mode={requiredMode}
      sx={fillParent ? { flex: 1, minHeight: 0, height: '100%' } : undefined}
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
        <Typography
          sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}
        >
          {t('planner.storeHero.title')}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={requiredMode}
          onChange={handleRequiredMode}
          aria-label={t('planner.hero.modeAria')}
          data-testid="store-hero-required-mode"
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
      <EvaluationLegend items={legendItems} testId="store-evaluation-legend" />
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
                margin: { l: 44, r: 12, t: 16, b: 36 },
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
                displayModeBar: true,
                displaylogo: false,
                responsive: false,
                scrollZoom: true,
                modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
              }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
            />
          </Suspense>
        </Box>
      </Box>
      {isPressure ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          {t(tickSuffix === '%' ? 'planner.hero.captionPressure' : 'planner.hero.captionPressureMin', {
            yearStart: yearStartLabel ?? '—',
            lastFact: lastFactLabel ?? '—',
            horizonEnd: horizonEndLabel ?? '—',
            target: String(target),
          })}
        </Typography>
      ) : null}
    </Stack>
  );
}
