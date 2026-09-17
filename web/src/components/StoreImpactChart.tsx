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
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from '@mui/material';
import type { PlotMouseEvent } from 'plotly.js';

import type { StoreImpactPoint, StoreMonthCell } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import {
  applyTraceHoverFocus,
  buildStoreImpactTraces,
  buildStoreImpactXAxis,
  buildStoreImpactYAxis,
  buildHighlightedMonthShape,
  buildTier4FlagMarkerTrace,
  buildTier4FlagShapes,
  collectStoreImpactYValues,
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
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);
  const [yScaleMode, setYScaleMode] = useState<StoreImpactYScaleMode>('fit');
  const [focusedTraceIndex, setFocusedTraceIndex] = useState<number | null>(null);

  const storeIds = useMemo(() => getStoreIds(series), [series]);
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
  const flaggedForStore = useMemo(
    () =>
      activeStoreId == null ? [] : filterFlaggedMonthsForStore(highStoreMonths, activeStoreId),
    [highStoreMonths, activeStoreId],
  );

  const baseTraces = useMemo(() => {
    const base = buildStoreImpactTraces(storePoints);
    const flagTrace = buildTier4FlagMarkerTrace(storePoints, flaggedForStore);
    return flagTrace ? [...base, flagTrace] : base;
  }, [storePoints, flaggedForStore]);

  const traces = useMemo(
    () => applyTraceHoverFocus(baseTraces, focusedTraceIndex),
    [baseTraces, focusedTraceIndex],
  );

  const periodLabels = useMemo(
    () => storePoints.map((point) => point.period_label),
    [storePoints],
  );

  const shapes = useMemo(() => {
    const bands = buildTier4FlagShapes(periodLabels, flaggedForStore);
    const highlight = buildHighlightedMonthShape(periodLabels, highlightedPeriodLabel);
    return highlight ? [...bands, highlight] : bands;
  }, [periodLabels, flaggedForStore, highlightedPeriodLabel]);

  const yAxis = useMemo(
    () => buildStoreImpactYAxis(yScaleMode, collectStoreImpactYValues(storePoints)),
    [yScaleMode, storePoints],
  );
  const xAxis = useMemo(() => buildStoreImpactXAxis(periodLabels), [periodLabels]);

  const handleStoreChange = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
    setFocusedTraceIndex(null);
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
        title="Store impact"
        titleTypographyProps={{ variant: 'subtitle1' }}
        sx={{ pb: 0, pt: 1.5, px: 2 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, mr: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={yScaleMode}
              onChange={handleYScaleChange}
              aria-label="Y-axis scale"
            >
              <ToggleButton value="fit" aria-label="Fit to data">
                Fit
              </ToggleButton>
              <ToggleButton value="full" aria-label="0 to 100 percent">
                0–100%
              </ToggleButton>
            </ToggleButtonGroup>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="store-impact-store-label">Store</InputLabel>
              <Select
                labelId="store-impact-store-label"
                label="Store"
                value={activeStoreId ?? ''}
                onChange={handleStoreChange}
              >
                {storeIds.map((storeId) => (
                  <MenuItem key={storeId} value={storeId}>
                    Store {storeId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
