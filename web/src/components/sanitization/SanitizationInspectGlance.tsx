import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { useT } from '../../i18n';
import type { StoreImpactPoint, StoreMonthCell } from '../../schemas/api';
import {
  computePeriodKpisFromPoints,
  filterStoreSeries,
} from '../charts/storeImpactChartData';

interface SanitizationInspectGlanceProps {
  storeId: number | null;
  series: StoreImpactPoint[];
  highStoreMonths: StoreMonthCell[];
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

function GlanceCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
          lineHeight: 1.3,
          color: valueColor ?? 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Compact store KPI strip for Sanitization Inspect (mirrors Planner InspectStoreGlance). */
export function SanitizationInspectGlance({
  storeId,
  series,
  highStoreMonths,
}: SanitizationInspectGlanceProps) {
  const t = useT();

  const kpis = useMemo(() => {
    if (storeId == null) {
      return { baseline_top_box_pct: null, final_top_box_pct: null, delta_pp: null };
    }
    return computePeriodKpisFromPoints(filterStoreSeries(series, storeId));
  }, [series, storeId]);

  const flaggedForStore = useMemo(() => {
    if (storeId == null) {
      return 0;
    }
    return highStoreMonths.filter((row) => row.flagged && row.store_id === storeId).length;
  }, [highStoreMonths, storeId]);

  const deltaColor =
    kpis.delta_pp == null || kpis.delta_pp === 0
      ? undefined
      : kpis.delta_pp > 0
        ? 'success.main'
        : 'error.main';

  return (
    <Stack
      spacing={0.5}
      data-testid="sanitization-inspect-glance"
      sx={{
        flexShrink: 0,
        px: 0.25,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {storeId != null
          ? t('sanitization.inspect.glanceSub', { id: storeId })
          : t('sanitization.inspect.glanceSubEmpty')}
      </Typography>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ rowGap: 0.75 }}>
        <GlanceCell label={t('kpi.baselineNetwork')} value={formatPct(kpis.baseline_top_box_pct)} />
        <GlanceCell label={t('kpi.finalNetwork')} value={formatPct(kpis.final_top_box_pct)} />
        <GlanceCell
          label={t('kpi.deltaNetwork')}
          value={formatDelta(kpis.delta_pp)}
          valueColor={deltaColor}
        />
        <GlanceCell
          label={t('sanitization.inspect.glanceFlagged')}
          value={String(flaggedForStore)}
          valueColor={flaggedForStore > 0 ? 'warning.main' : undefined}
        />
      </Stack>
    </Stack>
  );
}
