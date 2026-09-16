import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
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

import type { StoreImpactPoint, StoreMonthCell } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import {
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

interface StoreImpactChartProps {
  series: StoreImpactPoint[];
  highStoreMonths?: StoreMonthCell[];
}

export function StoreImpactChart({ series, highStoreMonths = [] }: StoreImpactChartProps) {
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);
  const [yScaleMode, setYScaleMode] = useState<StoreImpactYScaleMode>('fit');

  const storeIds = useMemo(() => getStoreIds(series), [series]);

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

  const traces = useMemo(() => {
    const base = buildStoreImpactTraces(storePoints);
    const flagTrace = buildTier4FlagMarkerTrace(storePoints, flaggedForStore);
    return flagTrace ? [...base, flagTrace] : base;
  }, [storePoints, flaggedForStore]);

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
  };

  const handleYScaleChange = (
    _event: MouseEvent<HTMLElement>,
    next: StoreImpactYScaleMode | null,
  ) => {
    if (next != null) {
      setYScaleMode(next);
    }
  };

  if (storeIds.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader
        title="Store impact"
        subheader="Actual vs sanitized 5% KPI by month"
        action={
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
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
            <FormControl size="small" sx={{ minWidth: 140 }}>
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
      <CardContent>
        <Box sx={{ width: '100%', minHeight: 360 }}>
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
                height: 360,
                margin: { l: 48, r: 24, t: 16, b: 48 },
                xaxis: xAxis,
                yaxis: yAxis,
                shapes,
                legend: { orientation: 'h', y: -0.15 },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
            />
          </Suspense>
        </Box>
      </CardContent>
    </Card>
  );
}
