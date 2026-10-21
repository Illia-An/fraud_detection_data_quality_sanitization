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

import { useT } from '../../i18n';
import type { ChartScopeMode, ChartTimeMode } from '../../schemas/chartUi';
import type { OrderBumpImpactPoint } from '../../schemas/ttsOrderBump';
import { useOrderBumpUiStore } from '../../store/ttsOrderBumpUiStore';
import { EvaluationLegend } from '../planner/EvaluationLegend';
import {
  aggregateOrderBumpNetworkSeries,
  applyTraceHoverFocus,
  buildOrderBumpTimelineTraces,
  buildOrderBumpYAxis,
  buildOrderBumpYoYTraces,
  buildStoreImpactXAxis,
  buildYoYImpactXAxis,
  collectOrderBumpYValues,
  collectOrderBumpYoYYValues,
  defaultOrderBumpStoreId,
  filterOrderBumpStoreSeries,
  getOrderBumpStoreIds,
  orderBumpLegendItems,
  toggleLegendHiddenName,
  type StoreImpactYScaleMode,
} from './orderBumpChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

const CHART_HEIGHT_PX = 550;

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

interface OrderBumpStoreImpactChartProps {
  series: OrderBumpImpactPoint[];
}

export function OrderBumpStoreImpactChart({ series }: OrderBumpStoreImpactChartProps) {
  const t = useT();
  const chartScope = useOrderBumpUiStore((s) => s.chartScope);
  const setChartScope = useOrderBumpUiStore((s) => s.setChartScope);
  const chartTimeMode = useOrderBumpUiStore((s) => s.chartTimeMode);
  const setChartTimeMode = useOrderBumpUiStore((s) => s.setChartTimeMode);
  const selectedStoreId = useOrderBumpUiStore((s) => s.selectedStoreId);
  const setSelectedStoreId = useOrderBumpUiStore((s) => s.setSelectedStoreId);

  const [yScaleMode, setYScaleMode] = useState<StoreImpactYScaleMode>('fit');
  const [focusedTraceIndex, setFocusedTraceIndex] = useState<number | null>(null);
  const [legendHiddenNames, setLegendHiddenNames] = useState<Set<string>>(() => new Set());

  const storeIds = useMemo(() => getOrderBumpStoreIds(series), [series]);
  const isNetwork = chartScope === 'network';
  const isYoY = chartTimeMode === 'yoy';
  const useCustomLegend = !isYoY;
  const plotContainerRef = usePlotContainerResize(storeIds.length > 0);
  const legendItems = useMemo(() => orderBumpLegendItems(), []);

  useEffect(() => {
    const next = defaultOrderBumpStoreId(series, selectedStoreId);
    if (next !== selectedStoreId) {
      setSelectedStoreId(next);
    }
  }, [series, selectedStoreId, setSelectedStoreId]);

  const activeStoreId = selectedStoreId ?? defaultOrderBumpStoreId(series, null);

  const storePoints = useMemo(
    () => (activeStoreId == null ? [] : filterOrderBumpStoreSeries(series, activeStoreId)),
    [series, activeStoreId],
  );

  const networkPoints = useMemo(
    () => aggregateOrderBumpNetworkSeries(series),
    [series],
  );

  const chartPoints = isNetwork ? networkPoints : storePoints;

  const baseTraces = useMemo(() => {
    if (isYoY) {
      return buildOrderBumpYoYTraces(chartPoints);
    }
    return buildOrderBumpTimelineTraces(chartPoints);
  }, [chartPoints, isYoY]);

  const baseTraceNamesKey = useMemo(
    () => baseTraces.map((tr) => tr.name).join('\0'),
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
    () => chartPoints.map((p) => p.period_label),
    [chartPoints],
  );

  const yAxis = useMemo(
    () =>
      buildOrderBumpYAxis(
        yScaleMode,
        isYoY
          ? collectOrderBumpYoYYValues(chartPoints)
          : collectOrderBumpYValues(chartPoints),
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
    return false;
  };

  if (storeIds.length === 0) {
    return (
      <Card variant="outlined" data-testid="tts-order-impact-chart">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {t('ttsOrder.chart.empty')}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const controls = (
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
        aria-label={t('ttsOrder.chart.yScaleAria')}
      >
        <ToggleButton value="fit" aria-label={t('chart.fitAria')}>
          {t('chart.fit')}
        </ToggleButton>
        <ToggleButton value="full" aria-label={t('ttsOrder.chart.fromZeroAria')}>
          {t('ttsOrder.chart.fromZero')}
        </ToggleButton>
      </ToggleButtonGroup>
      {isNetwork ? (
        <Tooltip title={t('ttsOrder.chart.networkChipTip')}>
          <Chip
            size="small"
            label={t('chart.networkChip')}
            variant="outlined"
            sx={{ opacity: 0.85 }}
          />
        </Tooltip>
      ) : null}
      {isYoY ? (
        <Tooltip title={t('ttsOrder.chart.yoyChipTip')}>
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
            sx={{ minWidth: 120, opacity: isNetwork ? 0.5 : 1 }}
            disabled={isNetwork}
          >
            <InputLabel id="tts-order-store-impact-label">{t('common.store')}</InputLabel>
            <Select
              labelId="tts-order-store-impact-label"
              label={t('common.store')}
              value={activeStoreId ?? ''}
              onChange={handleStoreChange}
              inputProps={{ 'aria-label': t('common.store') }}
              data-testid="tts-order-store-select"
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
  );

  const plotBody = (
    <Box
      ref={plotContainerRef}
      data-testid="tts-order-impact-plot"
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
            margin: { l: 52, r: 16, t: 12, b: useCustomLegend ? 40 : 56 },
            xaxis: xAxis,
            yaxis: yAxis,
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
      <EvaluationLegend items={legendItems} testId="tts-order-impact-legend" />
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {t('chart.legendHint')}
      </Typography>
    </Stack>
  ) : null;

  return (
    <Card
      variant="outlined"
      data-testid="tts-order-impact-chart"
      sx={{ flex: 1, minHeight: 0, mb: 0, height: '100%' }}
    >
      <CardHeader
        title={
          isNetwork ? t('ttsOrder.chart.titleNetwork') : t('ttsOrder.chart.titleStore')
        }
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
