import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

const CHART_MIN_HEIGHT_PX = 200;
const CHART_FALLBACK_HEIGHT_PX = 280;

function usePlotContainerHeight(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(CHART_FALLBACK_HEIGHT_PX);

  useEffect(() => {
    const node = containerRef.current;
    if (!enabled || !node || typeof ResizeObserver === 'undefined') {
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.floor(entries[0]?.contentRect.height ?? 0);
        if (next >= CHART_MIN_HEIGHT_PX) {
          setHeight(next);
        }
        window.dispatchEvent(new Event('resize'));
      });
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled]);

  return { containerRef, height };
}

interface HeroSimulationChartProps {
  draftPlan: FivePercentPlan;
  approvedPlan: FivePercentPlan | null;
  /** Soft envelope half-width (pp); not a statistical CI. */
  slackBandPp?: number;
}

/** V4.2 Component D — Approved vs Draft dual-trace hero (+ soft slack band, not CI). */
export function HeroSimulationChart({
  draftPlan,
  approvedPlan,
  slackBandPp = 1.5,
}: HeroSimulationChartProps) {
  const { containerRef, height: plotHeight } = usePlotContainerHeight(true);

  const { labels, draftYs, approvedYs, upperYs, lowerYs, target } = useMemo(() => {
    const labelsLocal = draftPlan.chain_trajectory.map((p) => periodLabel(p.year, p.month));
    const draftLocal = draftPlan.chain_trajectory.map((p) => p.score);
    const approvedLocal = labelsLocal.map((label) => {
      if (!approvedPlan) {
        return draftPlan.current_chain;
      }
      const [y, m] = label.split('-').map(Number);
      const hit = approvedPlan.chain_trajectory.find((p) => p.year === y && p.month === m);
      return hit?.score ?? null;
    });
    const upper = draftLocal.map((v) => Math.min(100, v + slackBandPp));
    const lower = draftLocal.map((v) => Math.max(0, v - slackBandPp));
    return {
      labels: labelsLocal,
      draftYs: draftLocal,
      approvedYs: approvedLocal,
      upperYs: upper,
      lowerYs: lower,
      target: draftPlan.target,
    };
  }, [draftPlan, approvedPlan, slackBandPp]);

  const yValues = [
    ...draftYs,
    ...approvedYs.filter((v): v is number => v != null),
    ...upperYs,
    ...lowerYs,
    target,
  ];
  const yMin = Math.max(0, Math.min(...yValues) - 2);
  const yMax = Math.min(100, Math.max(...yValues) + 2);

  const data = [
    {
      x: labels,
      y: upperYs,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { width: 0 },
      marker: { color: 'rgba(25, 118, 210, 0.15)' },
      name: 'Slack band',
      showlegend: false,
      hoverinfo: 'skip' as const,
    },
    {
      x: labels,
      y: lowerYs,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { width: 0 },
      fill: 'tonexty' as const,
      fillcolor: 'rgba(25, 118, 210, 0.12)',
      name: 'Slack band (±allocation)',
      hoverinfo: 'skip' as const,
    },
    {
      x: labels,
      y: approvedYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: approvedPlan ? 'Accepted plan' : 'Reference baseline',
      line: { color: '#9e9e9e', width: 2, dash: 'dash' },
      marker: { size: 6, color: '#9e9e9e' },
    },
    {
      x: labels,
      y: draftYs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: 'Draft simulation',
      line: { color: '#1565c0', width: 3 },
      marker: { size: 7, color: '#1565c0' },
    },
    {
      x: labels,
      y: labels.map(() => target),
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: 'Target',
      line: { color: '#c62828', width: 1.5, dash: 'dot' },
      hoverinfo: 'name+y' as const,
    },
  ];

  return (
    <Stack spacing={0.75} sx={{ height: '100%', minHeight: 0 }}>
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: CHART_MIN_HEIGHT_PX,
          width: '100%',
        }}
      >
        <Suspense
          fallback={
            <Box
              sx={{
                height: '100%',
                minHeight: CHART_MIN_HEIGHT_PX,
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
              xaxis: { title: '', tickangle: -30, automargin: true },
              yaxis: {
                title: '5% Score',
                range: [yMin, yMax],
                ticksuffix: '%',
              },
              showlegend: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: plotHeight }}
            useResizeHandler
          />
        </Suspense>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        Dual-trace hero · shaded band is allocation slack (±{slackBandPp.toFixed(1)} pp), not a
        statistical confidence interval.
      </Typography>
    </Stack>
  );
}
