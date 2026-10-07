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
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import type { PlotMouseEvent } from 'plotly.js';

import { useT } from '../i18n';
import type { PipelineConfig, StoreImpactPoint, StoreMonthCell } from '../schemas/api';
import { isPipelineStepEnabled } from '../schemas/api';
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
  toggleLegendHiddenName,
  type StoreImpactYScaleMode,
} from './charts/storeImpactChartData';
import {
  EvaluationLegend,
  networkImpactLegendItems,
} from './planner/EvaluationLegend';

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

export type StoreImpactChartLayout = 'default' | 'network' | 'store';

interface StoreImpactChartProps {
  series: StoreImpactPoint[];
  highStoreMonths?: StoreMonthCell[];
  /** Last run echo_config — hides disabled tier curves. */
  echoConfig?: PipelineConfig | null;
  /**
   * `network` — main Sanitization canvas (no store picker / scope toggle).
   * `store` — Inspect dialog (store picker, no Network toggle).
   * `default` — full Store|Network chrome.
   */
  layout?: StoreImpactChartLayout;
  /**
   * When false, skip the outer Card chrome so a parent (e.g. Sanitization Hero card)
   * can own the frame — mirrors Planner Hero wrapping HeroSimulationChart.
   */
  framed?: boolean;
  /** Override store picker; default is hidden only for `layout="network"`. */
  storeSelect?: boolean;
}

export function StoreImpactChart({
  series,
  highStoreMonths = [],
  echoConfig = null,
  layout = 'default',
  framed = true,
  storeSelect,
}: StoreImpactChartProps) {
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
  /** Trace names hidden via Plotly legend click — kept across hover re-renders. */
  const [legendHiddenNames, setLegendHiddenNames] = useState<Set<string>>(() => new Set());
  /** Store+timeline: show Tier 4 flagged month bands/markers (toggle next to Timeline/YoY). */
  const [showFlaggedOverlay, setShowFlaggedOverlay] = useState(true);

  const storeIds = useMemo(() => getStoreIds(series), [series]);
  const effectiveScope: ChartScopeMode =
    layout === 'network' ? 'network' : layout === 'store' ? 'store' : chartScope;
  const isNetwork = effectiveScope === 'network';
  const showScopeToggle = layout === 'default';
  const showStoreSelect = storeSelect ?? layout !== 'network';
  const isYoY = chartTimeMode === 'yoy';
  /** Timeline: custom legend + tips (Hero pattern). YoY keeps Plotly legend (dynamic years). */
  const useCustomLegend = !isYoY;
  const plotContainerRef = usePlotContainerResize(storeIds.length > 0);
  const legendItems = useMemo(
    () => networkImpactLegendItems(echoConfig),
    [echoConfig],
  );

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

  const tier4Enabled = isPipelineStepEnabled('tier4', echoConfig);
  /** Control visible on store timeline when Tier 4 is in the recipe (not Network). */
  const showFlaggedControl = !isNetwork && tier4Enabled && !isYoY;
  const flaggedOverlayAvailable = showFlaggedControl && flaggedForStore.length > 0;

  /** Store+timeline only: per-store Tier 4 overlays. Network/YoY declutter; user toggle. */
  const flaggedForChart = useMemo(() => {
    if (!showFlaggedOverlay || !flaggedOverlayAvailable) {
      return [];
    }
    return flaggedForStore;
  }, [showFlaggedOverlay, flaggedOverlayAvailable, flaggedForStore]);

  const baseTraces = useMemo(() => {
    if (isYoY) {
      return buildYoYImpactTraces(chartPoints);
    }
    const base = buildStoreImpactTraces(chartPoints, echoConfig);
    const flagTrace = buildTier4FlagMarkerTrace(chartPoints, flaggedForChart);
    return flagTrace ? [...base, flagTrace] : base;
  }, [chartPoints, flaggedForChart, isYoY, echoConfig]);

  const baseTraceNamesKey = useMemo(
    () => baseTraces.map((trace) => trace.name).join('\0'),
    [baseTraces],
  );

  useEffect(() => {
    setLegendHiddenNames(new Set());
    setFocusedTraceIndex(null);
  }, [baseTraceNamesKey]);

  const traces = useMemo(
    () => applyTraceHoverFocus(baseTraces, focusedTraceIndex, legendHiddenNames),
    [baseTraces, focusedTraceIndex, legendHiddenNames],
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
        isYoY
          ? collectYoYImpactYValues(chartPoints)
          : collectStoreImpactYValues(chartPoints, echoConfig),
      ),
    [yScaleMode, chartPoints, isYoY, echoConfig],
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
    if (typeof curveNumber !== 'number') {
      return;
    }
    const name = baseTraces[curveNumber]?.name;
    if (name != null && legendHiddenNames.has(name)) {
      return;
    }
    setFocusedTraceIndex(curveNumber);
  };

  const handlePlotUnhover = () => {
    setFocusedTraceIndex(null);
  };

  const handleLegendClick = (event: Readonly<{ curveNumber?: number }>) => {
    const curveNumber = event.curveNumber;
    if (typeof curveNumber !== 'number') {
      return false;
    }
    const name = baseTraces[curveNumber]?.name;
    if (name == null) {
      return false;
    }
    setLegendHiddenNames((prev) => toggleLegendHiddenName(prev, name));
    setFocusedTraceIndex(null);
    // Suppress Plotly's own visibility toggle — we own it in React state.
    return false;
  };

  if (storeIds.length === 0) {
    return null;
  }

  const chartTitle = layout === 'network' ? t('chart.titleNetwork') : t('chart.title');
  const controls = (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            justifyContent="flex-end"
            sx={{ mt: framed ? 0.5 : 0, mr: framed ? 1 : 0, maxWidth: { xs: '100%', md: 640 } }}
          >
            {showScopeToggle ? (
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
            ) : null}
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
            {showFlaggedControl ? (
              <Tooltip
                title={
                  flaggedOverlayAvailable
                    ? t('chart.flaggedTip')
                    : t('chart.flaggedDisabledTip')
                }
              >
                <span>
                  <ToggleButton
                    size="small"
                    value="flagged"
                    selected={showFlaggedOverlay && flaggedOverlayAvailable}
                    disabled={!flaggedOverlayAvailable}
                    onChange={() => setShowFlaggedOverlay((prev) => !prev)}
                    aria-label={t('chart.flaggedAria')}
                    data-testid="chart-flagged-toggle"
                    sx={{ px: 1 }}
                  >
                    {t('chart.flagged')}
                  </ToggleButton>
                </span>
              </Tooltip>
            ) : null}
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
            {showStoreSelect ? (
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
            ) : null}
          </Stack>
  );

  const plotBody = (
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
            margin: { l: 48, r: 16, t: 12, b: useCustomLegend ? 40 : 56 },
            xaxis: xAxis,
            yaxis: yAxis,
            shapes,
            hovermode: 'closest',
            showlegend: !useCustomLegend,
            legend: useCustomLegend ? undefined : { orientation: 'h', y: -0.12 },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
          onHover={handlePlotHover}
          onUnhover={handlePlotUnhover}
          onLegendClick={handleLegendClick}
        />
      </Suspense>
    </Box>
  );

  const legendBlock = useCustomLegend ? (
    <Stack spacing={0.35} sx={{ flexShrink: 0 }}>
      <EvaluationLegend
        items={legendItems}
        testId="store-impact-legend"
      />
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {t('chart.legendHint')}
      </Typography>
    </Stack>
  ) : null;

  if (!framed) {
    return (
      <Box
        data-testid="store-impact-chart-bare"
        sx={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          mb: 0,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
          justifyContent="space-between"
          sx={{ flexShrink: 0, px: 2, pt: 1, pb: 0 }}
        >
          <Box
            component="h3"
            sx={{
              m: 0,
              fontSize: '1rem',
              fontWeight: 500,
              lineHeight: 1.5,
              alignSelf: { md: 'center' },
            }}
          >
            {chartTitle}
          </Box>
          {controls}
        </Stack>
        <Stack spacing={0.75} sx={{ flex: 1, minHeight: 0, px: 2, pt: 1, pb: 1.5 }}>
          {legendBlock}
          <Box sx={{ flex: 1, minHeight: 0 }}>{plotBody}</Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', mb: 0 }}>
      <CardHeader
        title={chartTitle}
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 0, pt: 1.5, px: 2 }}
        action={controls}
      />
      <CardContent sx={{ pt: 1, px: 2, pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={0.75}>
          {legendBlock}
          {plotBody}
        </Stack>
      </CardContent>
    </Card>
  );
}
