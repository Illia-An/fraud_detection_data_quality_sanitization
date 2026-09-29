import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type SelectChangeEvent,
} from '@mui/material';
import type { PlotMouseEvent } from 'plotly.js';

import { useT } from '../i18n';
import type { StoreImpactPoint, StoreMonthCell } from '../schemas/api';
import type { ChartScopeMode, ChartTimeMode } from '../schemas/chartUi';
import { useUiStore } from '../store/uiStore';
import {
  aggregateNetworkSeries,
  applyTraceHoverFocus,
  buildStoreImpactTraces,
  buildStoreImpactXAxis,
  buildStoreImpactYAxis,
  buildHighlightedMonthShape,
  buildTier4FlagMarkerTrace,
  buildTier4FlagShapes,
  buildYoYImpactTraces,
  buildYoYImpactXAxis,
  collectStoreImpactYValues,
  collectYoYImpactYValues,
  defaultSelectedStoreId,
  filterFlaggedMonthsForStore,
  filterStoreSeries,
  getStoreIds,
  type StoreImpactYScaleMode,
} from './charts/storeImpactChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

/** Plot area height — primary visual for the results canvas. */
const CHART_HEIGHT_PX = 550;

/**
 * Plotly's useResizeHandler listens to window resize, not flex/CSS parent
 * width changes (controls rail / side nav collapse). Observe the container and
 * nudge Plotly via a window resize event.
 */
function usePlotContainerResize(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!enabled || !node || typeof ResizeObserver === 'undefined') {
      return;
    }

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
    observer.observe(node);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled]);

  return containerRef;
}

interface StoreImpactChartProps {
  series: StoreImpactPoint[];
  highStoreMonths?: StoreMonthCell[];
}

export function StoreImpactChart({ series, highStoreMonths = [] }: StoreImpactChartProps) {
  const t = useT();
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);
  const chartScope = useUiStore((state) => state.chartScope);
  const setChartScope = useUiStore((state) => state.setChartScope);
  const chartTimeMode = useUiStore((state) => state.chartTimeMode);
  const setChartTimeMode = useUiStore((state) => state.setChartTimeMode);
  const [yScaleMode, setYScaleMode] = useState<StoreImpactYScaleMode>('fit');
  const [focusedTraceIndex, setFocusedTraceIndex] = useState<number | null>(null);

  const storeIds = useMemo(() => getStoreIds(series), [series]);
  const isNetwork = chartScope === 'network';
  const isYoY = chartTimeMode === 'yoy';
  const plotContainerRef = usePlotContainerResize(storeIds.length > 0);

  useEffect(() => {
    const nextStoreId = defaultSelectedStoreId(series, selectedStoreId);
    if (nextStoreId !== selectedStoreId) {
      setSelectedStoreId(nextStoreId);
    }
  }, [series, selectedStoreId, setSelectedStoreId]);

  const activeStoreId = selectedStoreId ?? defaultSelectedStoreId(series, null);

  const storePoints = useMemo(
    () => (activeStoreId == null ? [] : filterStoreSeries(series, activeStoreId)),
    [series, activeStoreId],
  );

  const networkPoints = useMemo(() => aggregateNetworkSeries(series), [series]);

  const chartPoints = isNetwork ? networkPoints : storePoints;

  const flaggedForStore = useMemo(
    () =>
      activeStoreId == null ? [] : filterFlaggedMonthsForStore(highStoreMonths, activeStoreId),
    [highStoreMonths, activeStoreId],
  );

  /** Store+timeline only: per-store Tier 4 overlays. Network/YoY declutter. */
  const flaggedForChart = useMemo(
    () => (isNetwork || isYoY ? [] : flaggedForStore),
    [isNetwork, isYoY, flaggedForStore],
  );

  const baseTraces = useMemo(() => {
    if (isYoY) {
      return buildYoYImpactTraces(chartPoints);
    }
    const base = buildStoreImpactTraces(chartPoints);
    const flagTrace = buildTier4FlagMarkerTrace(chartPoints, flaggedForChart);
    return flagTrace ? [...base, flagTrace] : base;
  }, [chartPoints, flaggedForChart, isYoY]);

  const traces = useMemo(
    () => applyTraceHoverFocus(baseTraces, focusedTraceIndex),
    [baseTraces, focusedTraceIndex],
  );

  const periodLabels = useMemo(
    () => chartPoints.map((point) => point.period_label),
    [chartPoints],
  );

  const shapes = useMemo(() => {
    if (isYoY) {
      return [];
    }
    const bands = buildTier4FlagShapes(periodLabels, flaggedForChart);
    const highlight = buildHighlightedMonthShape(periodLabels, highlightedPeriodLabel);
    return highlight ? [...bands, highlight] : bands;
  }, [periodLabels, flaggedForChart, highlightedPeriodLabel, isYoY]);

  const yAxis = useMemo(
    () =>
      buildStoreImpactYAxis(
        yScaleMode,
        isYoY ? collectYoYImpactYValues(chartPoints) : collectStoreImpactYValues(chartPoints),
      ),
    [yScaleMode, chartPoints, isYoY],
  );
  const xAxis = useMemo(
    () => (isYoY ? buildYoYImpactXAxis() : buildStoreImpactXAxis(periodLabels)),
    [isYoY, periodLabels],
  );

  const handleStoreChange = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
    setFocusedTraceIndex(null);
  };

  const handleScopeChange = (
    _event: MouseEvent<HTMLElement>,
    next: ChartScopeMode | null,
  ) => {
    if (next != null) {
      setChartScope(next);
      setFocusedTraceIndex(null);
    }
  };

  const handleTimeModeChange = (
    _event: MouseEvent<HTMLElement>,
    next: ChartTimeMode | null,
  ) => {
    if (next != null) {
      setChartTimeMode(next);
      setFocusedTraceIndex(null);
    }
  };

  const handleYScaleChange = (
    _event: MouseEvent<HTMLElement>,
    next: StoreImpactYScaleMode | null,
  ) => {
    if (next != null) {
      setYScaleMode(next);
    }
  };

  const handlePlotHover = (event: Readonly<PlotMouseEvent>) => {
    const curveNumber = event.points?.[0]?.curveNumber;
    if (typeof curveNumber === 'number') {
      setFocusedTraceIndex(curveNumber);
    }
  };

  const handlePlotUnhover = () => {
    setFocusedTraceIndex(null);
  };

  if (storeIds.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', mb: 0 }}>
      <CardHeader
        title={t('chart.title')}
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 0, pt: 1.5, px: 2 }}
        action={
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            justifyContent="flex-end"
            sx={{ mt: 0.5, mr: 1, maxWidth: { xs: '100%', md: 640 } }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartScope}
              onChange={handleScopeChange}
              aria-label={t('chart.scopeAria')}
            >
              <ToggleButton value="store" aria-label={t('chart.scopeStoreAria')}>
                {t('chart.scopeStore')}
              </ToggleButton>
              <ToggleButton value="network" aria-label={t('chart.scopeNetworkAria')}>
                {t('chart.scopeNetwork')}
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartTimeMode}
              onChange={handleTimeModeChange}
              aria-label={t('chart.timeAria')}
            >
              <ToggleButton value="timeline" aria-label={t('chart.timelineAria')}>
                {t('chart.timeline')}
              </ToggleButton>
              <ToggleButton value="yoy" aria-label={t('chart.yoyAria')}>
                {t('chart.yoy')}
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={yScaleMode}
              onChange={handleYScaleChange}
              aria-label={t('chart.yScaleAria')}
            >
              <ToggleButton value="fit" aria-label={t('chart.fitAria')}>
                {t('chart.fit')}
              </ToggleButton>
              <ToggleButton value="full" aria-label={t('chart.fullAria')}>
                {t('chart.full')}
              </ToggleButton>
            </ToggleButtonGroup>
            {isNetwork ? (
              <Tooltip title={t('chart.networkChipTip')}>
                <Chip
                  size="small"
                  label={t('chart.networkChip')}
                  color="default"
                  variant="outlined"
                  sx={{ opacity: 0.85 }}
                />
              </Tooltip>
            ) : null}
            {isYoY ? (
              <Tooltip title={t('chart.yoyChipTip')}>
                <Chip size="small" label={t('chart.yoyChip')} variant="outlined" sx={{ opacity: 0.85 }} />
              </Tooltip>
            ) : null}
            <Tooltip
              title={isNetwork ? t('chart.storeDisabledTip') : ''}
              disableHoverListener={!isNetwork}
            >
              <span>
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 120,
                    opacity: isNetwork ? 0.5 : 1,
                  }}
                  disabled={isNetwork}
                >
                  <InputLabel id="store-impact-store-label">{t('common.store')}</InputLabel>
                  <Select
                    labelId="store-impact-store-label"
                    label={t('common.store')}
                    value={activeStoreId ?? ''}
                    onChange={handleStoreChange}
                    inputProps={{ 'aria-label': t('common.store') }}
                    sx={{ cursor: isNetwork ? 'not-allowed' : undefined }}
                  >
                    {storeIds.map((storeId) => (
                      <MenuItem key={storeId} value={storeId}>
                        {t('common.storeN', { id: storeId })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </span>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 1, px: 2, pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          ref={plotContainerRef}
          data-testid="store-impact-plot-container"
          sx={{ width: '100%', minHeight: CHART_HEIGHT_PX }}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            }
          >
            <Plot
              data={traces}
              layout={{
                autosize: true,
                height: CHART_HEIGHT_PX,
                margin: { l: 48, r: 16, t: 12, b: 40 },
                xaxis: xAxis,
                yaxis: yAxis,
                shapes,
                hovermode: 'closest',
                legend: { orientation: 'h', y: -0.12 },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
              onHover={handlePlotHover}
              onUnhover={handlePlotUnhover}
            />
          </Suspense>
        </Box>
      </CardContent>
    </Card>
  );
}
