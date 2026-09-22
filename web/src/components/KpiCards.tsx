import { Box, Card, CardContent, Grid2 as Grid, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import type { ProcessResponse, ResponseMeta, StoreImpactPoint } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import {
  computePeriodKpisFromPoints,
  filterStoreSeries,
} from './charts/storeImpactChartData';

interface KpiCardsProps {
  result: ProcessResponse;
}

const denseCardContentSx = {
  py: 0.5,
  px: 1,
  '&:last-child': { pb: 0.5 },
} as const;

const TELEMETRY_SCROLL_MAX_HEIGHT_PX = 36;

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}%`;
}

function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pp`;
}

function formatMs(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value.toFixed(1)} ms`;
}

function formatMb(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)} MB`;
}

function deltaColor(value: number | null | undefined): string | undefined {
  if (value == null || Number.isNaN(value) || value === 0) {
    return undefined;
  }
  // Positive delta = KPI rose after sanitization; negative = fell.
  return value > 0 ? 'success.main' : 'error.main';
}

function TelemetrySummary({ meta }: { meta: ResponseMeta }) {
  const lines = [
    { label: 'Time', value: formatMs(meta.execution_time_ms) },
    { label: 'RAM', value: formatMb(meta.peak_memory_mb) },
    { label: 'Rows', value: String(meta.rows_scanned ?? '—') },
  ];

  const queryBits = [
    meta.db_query_a_time_ms != null ? `A ${formatMs(meta.db_query_a_time_ms)}` : null,
    meta.db_query_b_time_ms != null ? `B ${formatMs(meta.db_query_b_time_ms)}` : null,
  ].filter(Boolean);

  return (
    <Stack spacing={0.25}>
      {lines.map((line) => (
        <Typography key={line.label} variant="caption" component="p" sx={{ m: 0 }}>
          <Typography component="span" variant="caption" color="text.secondary">
            {line.label}:{' '}
          </Typography>
          <Typography component="span" variant="caption" fontWeight={600}>
            {line.value}
          </Typography>
        </Typography>
      ))}
      {queryBits.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {queryBits.join(' · ')}
        </Typography>
      )}
    </Stack>
  );
}

function KpiMetricCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={denseCardContentSx}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0 }}>
          {label}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          fontWeight={700}
          color={valueColor}
          sx={{ m: 0, lineHeight: 1.25 }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function resolveStoreKpis(
  series: StoreImpactPoint[],
  storeId: number | null,
): ReturnType<typeof computePeriodKpisFromPoints> {
  if (storeId == null) {
    return { baseline_top_box_pct: null, final_top_box_pct: null, delta_pp: null };
  }
  return computePeriodKpisFromPoints(filterStoreSeries(series, storeId));
}

/** Verdict strip: Baseline / Final / delta / Run telemetry. Scope follows chart Store|Network. */
export function KpiCards({ result }: KpiCardsProps) {
  const chartScope = useUiStore((state) => state.chartScope);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);

  const storeKpis = useMemo(
    () => resolveStoreKpis(result.store_impact_series, selectedStoreId),
    [result.store_impact_series, selectedStoreId],
  );

  const useStoreScope = chartScope === 'store';
  const baseline = useStoreScope ? storeKpis.baseline_top_box_pct : result.baseline_top_box_pct;
  const finalPct = useStoreScope ? storeKpis.final_top_box_pct : result.final_top_box_pct;
  const delta = useStoreScope ? storeKpis.delta_pp : result.network_delta_pp;

  const baselineLabel = useStoreScope
    ? `Store ${selectedStoreId ?? '—'} baseline 5%`
    : 'Baseline 5%';
  const finalLabel = useStoreScope ? `Store ${selectedStoreId ?? '—'} final 5%` : 'Final 5%';
  const deltaLabel = useStoreScope ? `Store ${selectedStoreId ?? '—'} delta` : 'Network delta';

  return (
    <Grid container spacing={0.75} alignItems="stretch" data-testid="kpi-telemetry-strip">
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard label={baselineLabel} value={formatPct(baseline)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard label={finalLabel} value={formatPct(finalPct)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KpiMetricCard
          label={deltaLabel}
          value={formatDelta(delta)}
          valueColor={deltaColor(delta)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={denseCardContentSx}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0 }}>
              Run telemetry
            </Typography>
            <Box
              data-testid="run-telemetry-scroll"
              sx={{
                maxHeight: TELEMETRY_SCROLL_MAX_HEIGHT_PX,
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              <TelemetrySummary meta={result.meta} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
