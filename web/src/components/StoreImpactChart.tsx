import { lazy, Suspense, useEffect, useMemo } from 'react';
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
  type SelectChangeEvent,
} from '@mui/material';

import type { PipelineConfig, StoreImpactPoint } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import {
  buildStoreImpactTraces,
  defaultSelectedStoreId,
  filterStoreSeries,
  getStoreIds,
} from './charts/storeImpactChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

interface StoreImpactChartProps {
  series: StoreImpactPoint[];
  config: PipelineConfig;
}

export function StoreImpactChart({ series, config }: StoreImpactChartProps) {
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);

  const storeIds = useMemo(() => getStoreIds(series), [series]);

  useEffect(() => {
    const nextStoreId = defaultSelectedStoreId(series, selectedStoreId);
    if (nextStoreId !== selectedStoreId) {
      setSelectedStoreId(nextStoreId);
    }
  }, [series, selectedStoreId, setSelectedStoreId]);

  const activeStoreId = selectedStoreId ?? defaultSelectedStoreId(series, null);
  const storePoints = activeStoreId == null ? [] : filterStoreSeries(series, activeStoreId);
  const traces = buildStoreImpactTraces(storePoints, config);

  const handleStoreChange = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
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
          <FormControl size="small" sx={{ minWidth: 140, mt: 0.5 }}>
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
                xaxis: { title: { text: 'Month' } },
                yaxis: { title: { text: 'Top-box rate (%)' }, rangemode: 'tozero' },
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
