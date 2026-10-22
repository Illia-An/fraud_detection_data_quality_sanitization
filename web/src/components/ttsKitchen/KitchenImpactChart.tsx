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

import { buildTtsImpactTraces } from '../tts/ttsChartData';
import { useT } from '../../i18n';
import type { KitchenBeforeAfter } from '../../schemas/ttsKitchen';
import { KitchenCodeTable } from './KitchenCodeTable';
import { kitchenPlotPoints } from './kitchenChartData';

const Plot = lazy(async () => {
  const module = await import('react-plotly.js');
  return { default: module.default };
});

const PLOT_MIN_HEIGHT_PX = 280;

type KitchenScope = 'network' | 'store' | 'code';

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

interface KitchenImpactChartProps {
  result: KitchenBeforeAfter;
}

export function KitchenImpactChart({ result }: KitchenImpactChartProps) {
  const t = useT();
  const [scope, setScope] = useState<KitchenScope>('network');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(
    result.by_store[0]?.store_id ?? null,
  );
  const storeIds = useMemo(
    () => result.by_store.map((store) => store.store_id),
    [result.by_store],
  );

  useEffect(() => {
    if (selectedStoreId != null && storeIds.includes(selectedStoreId)) {
      return;
    }
    setSelectedStoreId(storeIds[0] ?? null);
  }, [selectedStoreId, storeIds]);

  const points = useMemo(() => {
    if (scope === 'store') {
      const store = result.by_store.find((row) => row.store_id === selectedStoreId);
      return kitchenPlotPoints(store?.months ?? []);
    }
    return kitchenPlotPoints(result.network_months);
  }, [result, scope, selectedStoreId]);

  const traces = useMemo(
    () =>
      buildTtsImpactTraces(points, {
        actual: t('tts.chart.actual'),
        ge30: t('kitchen.chart.after', { sec: result.tts_min_sec }),
      }),
    [points, t],
  );
  const plotting = scope !== 'code' && points.length > 0;
  const { containerRef, height: plotHeight } = usePlotBox(plotting);
  const monthLabels = traces[0]?.x ?? [];

  const handleScope = (_: MouseEvent<HTMLElement>, value: KitchenScope | null) => {
    if (value) {
      setScope(value);
    }
  };

  const handleStore = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
  };

  const scopeControls = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={scope}
        onChange={handleScope}
        aria-label={t('tts.chart.scopeAria')}
      >
        <ToggleButton value="network">{t('tts.chart.network')}</ToggleButton>
        <ToggleButton value="store">{t('tts.chart.store')}</ToggleButton>
        <ToggleButton value="code">{t('kitchen.chart.code')}</ToggleButton>
      </ToggleButtonGroup>
      {scope === 'store' ? (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="kitchen-store-select-label">{t('common.store')}</InputLabel>
          <Select
            labelId="kitchen-store-select-label"
            label={t('common.store')}
            value={selectedStoreId ?? ''}
            onChange={handleStore}
            data-testid="kitchen-store-select"
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
  );

  return (
    <Card
      variant="outlined"
      data-testid="kitchen-impact-chart"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderWidth: 2,
        borderColor: 'primary.light',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        sx={{ flexShrink: 0, px: 2, pt: 1.5, pb: 0.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="h3"
            sx={{ m: 0, fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 }}
          >
            {t('kitchen.chart.title')}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('kitchen.chart.subheader', {
              start: result.period_start,
              end: result.period_end,
            })}
          </Typography>
        </Box>
        {scopeControls}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 2, pb: 1.5 }}>
        {scope === 'code' ? (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <KitchenCodeTable result={result} />
          </Box>
        ) : points.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('kitchen.chart.empty')}
          </Typography>
        ) : (
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
                  margin: { l: 48, r: 16, t: 28, b: 48 },
                  yaxis: { title: { text: t('tts.chart.yAxis') }, ticksuffix: ' s' },
                  xaxis: {
                    title: { text: t('kitchen.chart.xAxis') },
                    type: 'category',
                    categoryorder: 'array',
                    categoryarray: monthLabels,
                  },
                  legend: { orientation: 'h', y: 1.08 },
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
      </Box>
    </Card>
  );
}
