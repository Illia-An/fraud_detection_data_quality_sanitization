import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';

import { useT } from '../../i18n';
import { buildTtsImpactTraces, TTS_CHART_COLORS } from '../tts/ttsChartData';
import {
  buildKitchenFitRange,
  collectKitchenMeanSeconds,
  type KitchenPlotPoint,
} from './kitchenChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

const PLOT_MIN_HEIGHT_PX = 280;

function usePlotBox(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(PLOT_MIN_HEIGHT_PX);

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
        if (next > 80) {
          setHeight((current) => (current === next ? current : next));
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

function LegendItem({
  color,
  label,
  tip,
  testId,
}: {
  color: string;
  label: string;
  tip: string;
  testId: string;
}) {
  return (
    <Tooltip title={tip} enterDelay={200} describeChild>
      <Box
        component="span"
        tabIndex={0}
        aria-label={`${label}. ${tip}`}
        data-testid={testId}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'help',
          outline: 'none',
          '&:focus-visible': {
            borderRadius: 0.5,
            boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
          },
        }}
      >
        <Box
          aria-hidden
          sx={{ width: 16, height: 3, borderRadius: 1, bgcolor: color, flexShrink: 0 }}
        />
        <Typography
          component="span"
          sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2, color: 'text.secondary' }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

interface KitchenMeanChartProps {
  points: KitchenPlotPoint[];
  minSec: number;
  showFit?: boolean;
  legendTestId?: string;
  actualTestId?: string;
  afterTestId?: string;
  fitTestId?: string;
}

/** Two dwell-time lines, fitted to seconds. No scope switch and no Inspect button. */
export function KitchenMeanChart({
  points,
  minSec,
  showFit = false,
  legendTestId = 'kitchen-chart-legend',
  actualTestId = 'kitchen-legend-actual',
  afterTestId = 'kitchen-legend-after',
  fitTestId = 'kitchen-fit',
}: KitchenMeanChartProps) {
  const t = useT();
  const actualLabel = t('tts.chart.actual');
  const afterLabel = t('kitchen.chart.after', { sec: minSec });
  const traces = useMemo(
    () =>
      buildTtsImpactTraces(points, {
        actual: actualLabel,
        ge30: afterLabel,
      }),
    [points, actualLabel, afterLabel],
  );
  const yRange = useMemo(
    () => buildKitchenFitRange(collectKitchenMeanSeconds(points)),
    [points],
  );
  const { containerRef, height: plotHeight } = usePlotBox(points.length > 0);
  const monthLabels = traces[0]?.x ?? [];

  if (points.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('kitchen.chart.empty')}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.75} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        justifyContent="space-between"
        useFlexGap
        flexWrap="wrap"
      >
        <Stack spacing={0.35} sx={{ flexShrink: 0 }} data-testid={legendTestId}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <LegendItem
              color={TTS_CHART_COLORS.actual}
              label={actualLabel}
              tip={t('kitchen.chart.legend.actualTip')}
              testId={actualTestId}
            />
            <LegendItem
              color={TTS_CHART_COLORS.ge30}
              label={afterLabel}
              tip={t('kitchen.chart.legend.afterTip')}
              testId={afterTestId}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {t('chart.legendHint')}
          </Typography>
        </Stack>
        {showFit ? (
          <ToggleButtonGroup size="small" exclusive value="fit" aria-label={t('chart.yScaleAria')}>
            <ToggleButton value="fit" aria-label={t('chart.fitAria')} data-testid={fitTestId}>
              {t('chart.fit')}
            </ToggleButton>
          </ToggleButtonGroup>
        ) : null}
      </Stack>
      <Box ref={containerRef} sx={{ flex: 1, minHeight: PLOT_MIN_HEIGHT_PX, width: '100%' }}>
        <Suspense
          fallback={
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
              <CircularProgress size={28} />
            </Stack>
          }
        >
          <Plot
            data={traces}
            layout={{
              autosize: true,
              height: plotHeight,
              margin: { l: 48, r: 16, t: 12, b: 48 },
              showlegend: false,
              yaxis: {
                title: { text: t('tts.chart.yAxis') },
                ticksuffix: ' s',
                range: yRange ?? undefined,
              },
              xaxis: {
                title: { text: t('kitchen.chart.xAxis') },
                type: 'category',
                categoryorder: 'array',
                categoryarray: monthLabels,
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </Suspense>
      </Box>
    </Stack>
  );
}
