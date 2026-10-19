import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
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
  type SelectChangeEvent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { useT } from '../../i18n';
import type { TtsStoreImpactPoint } from '../../schemas/tts';
import { useTtsUiStore } from '../../store/ttsUiStore';
import {
  aggregateTtsNetworkSeries,
  buildTtsImpactTraces,
  defaultTtsSelectedStoreId,
  filterTtsStoreSeries,
  getTtsStoreIds,
} from './ttsChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

const CHART_HEIGHT_PX = 420;

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

interface TtsStoreImpactChartProps {
  series: TtsStoreImpactPoint[];
}

export function TtsStoreImpactChart({ series }: TtsStoreImpactChartProps) {
  const t = useT();
  const chartScope = useTtsUiStore((s) => s.chartScope);
  const setChartScope = useTtsUiStore((s) => s.setChartScope);
  const selectedStoreId = useTtsUiStore((s) => s.selectedStoreId);
  const setSelectedStoreId = useTtsUiStore((s) => s.setSelectedStoreId);
  const containerRef = usePlotContainerResize(series.length > 0);

  const storeIds = useMemo(() => getTtsStoreIds(series), [series]);

  useEffect(() => {
    if (chartScope !== 'store') {
      return;
    }
    const next = defaultTtsSelectedStoreId(series, selectedStoreId);
    if (next != null && next !== selectedStoreId) {
      setSelectedStoreId(next);
    }
  }, [chartScope, series, selectedStoreId, setSelectedStoreId]);

  const points = useMemo(() => {
    if (chartScope === 'network') {
      return aggregateTtsNetworkSeries(series);
    }
    if (selectedStoreId == null) {
      return [];
    }
    return filterTtsStoreSeries(series, selectedStoreId);
  }, [chartScope, series, selectedStoreId]);

  const traces = useMemo(
    () =>
      buildTtsImpactTraces(points, {
        actual: t('tts.chart.actual'),
        ge30: t('tts.chart.ge30'),
      }),
    [points, t],
  );

  const handleScope = (
    _: MouseEvent<HTMLElement>,
    value: 'store' | 'network' | null,
  ) => {
    if (value) {
      setChartScope(value);
    }
  };

  const handleStore = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
  };

  return (
    <Card variant="outlined" data-testid="tts-impact-chart" sx={{ flex: 1, minHeight: 0 }}>
      <CardHeader
        title={t('tts.chart.title')}
        subheader={t('tts.chart.subheader')}
        titleTypographyProps={{ variant: 'subtitle1' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartScope}
              onChange={handleScope}
              aria-label={t('tts.chart.scopeAria')}
            >
              <ToggleButton value="network">{t('tts.chart.network')}</ToggleButton>
              <ToggleButton value="store">{t('tts.chart.store')}</ToggleButton>
            </ToggleButtonGroup>
            {chartScope === 'store' ? (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="tts-store-select-label">{t('common.store')}</InputLabel>
                <Select
                  labelId="tts-store-select-label"
                  label={t('common.store')}
                  value={selectedStoreId ?? ''}
                  onChange={handleStore}
                  data-testid="tts-store-select"
                >
                  {storeIds.map((id) => (
                    <MenuItem key={id} value={id}>
                      {t('common.storeN', { id })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Stack>
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1 }}>
        {series.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('tts.chart.empty')}
          </Typography>
        ) : (
          <Box ref={containerRef} sx={{ width: '100%', height: CHART_HEIGHT_PX }}>
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
                  height: CHART_HEIGHT_PX,
                  margin: { l: 48, r: 16, t: 24, b: 40 },
                  yaxis: { title: { text: t('tts.chart.yAxis') }, ticksuffix: ' s' },
                  xaxis: { title: { text: t('tts.chart.xAxis') } },
                  legend: { orientation: 'h', y: 1.12 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler
              />
            </Suspense>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
