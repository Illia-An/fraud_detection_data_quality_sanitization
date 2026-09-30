import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { buildHeroEvaluationSeries } from './heroEvaluationSeries';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

/** Datadog Evaluation View — fixed hero height (~340px plot). */
export const HERO_PLOT_HEIGHT_PX = 340;

interface HeroSimulationChartProps {
  draftPlan: FivePercentPlan;
  approvedPlan: FivePercentPlan | null;
  panel: SanitizedPanel;
  asOfYear: number;
  asOfMonth: number;
  /** Soft envelope half-width (pp); not a statistical CI. */
  slackBandPp?: number;
}

/** Dual-trace Evaluation View: cleansed fact | as-of | forecast cone + target. */
export function HeroSimulationChart({
  draftPlan,
  approvedPlan,
  panel,
  asOfYear,
  asOfMonth,
  slackBandPp = 1.5,
}: HeroSimulationChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotHeight, setPlotHeight] = useState(HERO_PLOT_HEIGHT_PX);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.floor(entries[0]?.contentRect.height ?? 0);
        if (next >= 200) {
          setPlotHeight(next);
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
    () =>
      buildHeroEvaluationSeries(
        draftPlan,
        approvedPlan,
        panel,
        { year: asOfYear, month: asOfMonth },
        slackBandPp,
      ),
    [draftPlan, approvedPlan, panel, asOfYear, asOfMonth, slackBandPp],
  );

  const {
    labels,
    factYs,
    cumulativeYs,
    draftYs,
    approvedYs,
    upperYs,
    lowerYs,
    target,
    asOfLabel,
  } = series;

  const yValues = [
    ...factYs.filter((v): v is number => v != null),
    ...cumulativeYs.filter((v): v is number => v != null),
    ...draftYs.filter((v): v is number => v != null),
    ...approvedYs.filter((v): v is number => v != null),
    ...upperYs.filter((v): v is number => v != null),
    ...lowerYs.filter((v): v is number => v != null),
    target,
  ];
  const yMin = yValues.length ? Math.max(0, Math.min(...yValues) - 2) : 0;
  const yMax = yValues.length ? Math.min(100, Math.max(...yValues) + 2) : 100;

  const hoverPct = '%{x}<br>%{fullData.name}: %{y:.2f}%<extra></extra>';

  const data = [
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
    {
      x: labels,
      y: approvedYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: approvedPlan ? t('planner.hero.accepted') : t('planner.hero.baseline'),
      line: { color: '#9e9e9e', width: 2, dash: 'dash' as const },
      marker: { size: 6, color: '#9e9e9e' },
      connectgaps: false,
      hovertemplate: hoverPct,
    },
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
    {
      x: labels,
      y: labels.map(() => target),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: t('planner.hero.target'),
      line: { color: '#c62828', width: 1.5, dash: 'dot' as const },
      hovertemplate: hoverPct,
    },
  ];

  return (
    <Stack spacing={0.75} sx={{ height: '100%', minHeight: 0 }} data-testid="hero-evaluation-chart">
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: HERO_PLOT_HEIGHT_PX,
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          isolation: 'isolate',
        }}
      >
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
              margin: { l: 48, r: 16, t: 28, b: 40 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              legend: { orientation: 'h', y: 1.12, x: 0 },
              xaxis: { title: { text: '' }, tickangle: -30, automargin: true },
              yaxis: {
                title: { text: '5% Score' },
                range: [yMin, yMax],
                ticksuffix: '%',
              },
              shapes: [
                {
                  type: 'line',
                  x0: asOfLabel,
                  x1: asOfLabel,
                  y0: 0,
                  y1: 1,
                  yref: 'paper',
                  line: { color: '#616161', width: 1.5, dash: 'dash' as const },
                },
              ],
              annotations: [
                {
                  x: asOfLabel,
                  y: 1,
                  yref: 'paper',
                  text: t('planner.hero.asOf'),
                  showarrow: false,
                  xanchor: 'left',
                  yanchor: 'bottom',
                  font: { size: 11, color: '#616161' },
                  xshift: 4,
                },
              ],
              showlegend: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: plotHeight }}
            useResizeHandler
          />
        </Suspense>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {t('planner.hero.caption', {
          asOf: asOfLabel,
          slack: slackBandPp.toFixed(1),
        })}
      </Typography>
    </Stack>
  );
}
