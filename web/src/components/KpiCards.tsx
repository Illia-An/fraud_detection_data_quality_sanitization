import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useT } from '../i18n';
import type { ProcessResponse, ResponseMeta, StoreImpactPoint } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import {
  computePeriodKpisFromPoints,
  filterStoreSeries,
} from './charts/storeImpactChartData';

interface KpiCardsProps {
  result: ProcessResponse;
  /** Lock strip to network (main canvas) or follow chart Store|Network toggle. */
  scopeMode?: 'auto' | 'network' | 'store';
  /**
   * When true, MiniCards participate in a parent flex glance row (`display: contents`).
   * When false (default), this component owns a compact flex strip.
   */
  embedded?: boolean;
}

const labelSx = {
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'text.secondary',
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
} as const;

const valueSx = {
  fontSize: '0.8rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
} as const;

const hintSx = {
  fontSize: '0.65rem',
  fontWeight: 400,
  color: 'text.secondary',
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
} as const;

const chipSx = {
  height: 18,
  fontSize: '0.65rem',
  fontWeight: 600,
  '& .MuiChip-label': { px: 0.6 },
} as const;

function MiniCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: 'fit-content',
        maxWidth: '100%',
        flex: '0 1 auto',
        px: 1,
        py: 0.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.15,
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

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

function deltaChipColor(
  value: number | null | undefined,
): 'default' | 'success' | 'error' {
  if (value == null || Number.isNaN(value) || value === 0) {
    return 'default';
  }
  // Positive delta = KPI rose after sanitization; negative = fell.
  return value > 0 ? 'success' : 'error';
}

function formatTelemetryLine(meta: ResponseMeta, t: ReturnType<typeof useT>): string {
  const parts = [
    `${t('kpi.time')}: ${formatMs(meta.execution_time_ms)}`,
    `${t('kpi.ram')}: ${formatMb(meta.peak_memory_mb)}`,
    `${t('kpi.rows')}: ${meta.rows_scanned ?? '—'}`,
  ];
  const queryBits = [
    meta.db_query_a_time_ms != null ? `A ${formatMs(meta.db_query_a_time_ms)}` : null,
    meta.db_query_b_time_ms != null ? `B ${formatMs(meta.db_query_b_time_ms)}` : null,
  ].filter(Boolean);
  if (queryBits.length > 0) {
    parts.push(queryBits.join(' · '));
  }
  return parts.join(' · ');
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

/** Compact verdict strip: Baseline / Final / delta / Run telemetry (Planner MiniCard glance). */
export function KpiCards({
  result,
  scopeMode = 'auto',
  embedded = false,
}: KpiCardsProps) {
  const t = useT();
  const chartScope = useUiStore((state) => state.chartScope);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);

  const storeKpis = useMemo(
    () => resolveStoreKpis(result.store_impact_series, selectedStoreId),
    [result.store_impact_series, selectedStoreId],
  );

  const effectiveScope =
    scopeMode === 'auto' ? chartScope : scopeMode === 'network' ? 'network' : 'store';
  const useStoreScope = effectiveScope === 'store';
  const baseline = useStoreScope ? storeKpis.baseline_top_box_pct : result.baseline_top_box_pct;
  const finalPct = useStoreScope ? storeKpis.final_top_box_pct : result.final_top_box_pct;
  const delta = useStoreScope ? storeKpis.delta_pp : result.network_delta_pp;
  const storeId = selectedStoreId ?? '—';

  const baselineLabel = useStoreScope
    ? t('kpi.baselineStore', { id: storeId })
    : t('kpi.baselineNetwork');
  const finalLabel = useStoreScope
    ? t('kpi.finalStore', { id: storeId })
    : t('kpi.finalNetwork');
  const finalHint = useStoreScope ? t('kpi.finalStoreHint') : t('kpi.finalNetworkHint');
  const deltaLabel = useStoreScope
    ? t('kpi.deltaStore', { id: storeId })
    : t('kpi.deltaNetwork');

  return (
    <Box
      data-testid="kpi-telemetry-strip"
      sx={
        embedded
          ? { display: 'contents' }
          : {
              display: 'flex',
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              gap: 0.75,
              width: '100%',
              overflowX: { md: 'auto' },
            }
      }
    >
      <MiniCard>
        <Typography sx={labelSx}>{baselineLabel}</Typography>
        <Typography sx={valueSx}>{formatPct(baseline)}</Typography>
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{finalLabel}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography sx={valueSx}>{formatPct(finalPct)}</Typography>
          <Typography sx={hintSx}>{finalHint}</Typography>
        </Stack>
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{deltaLabel}</Typography>
        <Chip
          size="small"
          label={formatDelta(delta)}
          color={deltaChipColor(delta)}
          data-testid="kpi-network-delta"
          sx={chipSx}
        />
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{t('kpi.telemetry')}</Typography>
        <Typography
          sx={{ ...valueSx, fontWeight: 600 }}
          data-testid="run-telemetry-summary"
        >
          {formatTelemetryLine(result.meta, t)}
        </Typography>
      </MiniCard>
    </Box>
  );
}
