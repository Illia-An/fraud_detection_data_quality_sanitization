import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { useT } from '../../i18n';
import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import {
  SIGNAL_COLORS,
  type PlanMonitoringInsights,
} from '../../schemas/planMonitoring';
import {
  baselineScore,
  planEndScore,
  type StoreBaselineRow,
} from './atRiskRowMetrics';

interface InspectStoreGlanceProps {
  plan: FivePercentPlan;
  insights: PlanMonitoringInsights;
  storeId: number;
  baselineRows: StoreBaselineRow[];
  /** Local Estimate preview for last-month end (before/without Apply). */
  draftLast: number | null;
}

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

function formatGapPp(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)} pp`;
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

/** Compact At-risk metrics for one store — updates with plan / Estimate preview. */
export function InspectStoreGlance({
  plan,
  insights,
  storeId,
  baselineRows,
  draftLast,
}: InspectStoreGlanceProps) {
  const t = useT();
  const monitor = insights.stores.find((s) => s.store_id === storeId);
  const asOfLabel = periodLabel(insights.as_of_year, insights.as_of_month);

  const metrics = useMemo(() => {
    const fact = monitor?.actual ?? null;
    const planAtAsOf = monitor?.planned ?? null;
    const gapPp = monitor?.deviation ?? null;
    const baseline = baselineScore(baselineRows, storeId);
    const endFromPlan = planEndScore(plan, storeId);
    const end = draftLast ?? endFromPlan;
    const liftToEnd =
      fact != null && end != null ? Math.round((end - fact) * 100) / 100 : null;
    return { fact, planAtAsOf, gapPp, baseline, end, liftToEnd };
  }, [monitor, baselineRows, storeId, plan, draftLast]);

  const gapColor =
    metrics.gapPp == null
      ? undefined
      : metrics.gapPp < -1e-9
        ? SIGNAL_COLORS.behind_plan
        : metrics.gapPp > 1e-9
          ? SIGNAL_COLORS.ahead_of_plan
          : undefined;

  return (
    <Stack
      spacing={0.5}
      data-testid="inspect-store-glance"
      sx={{
        flexShrink: 0,
        px: 0.25,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {t('planner.inspect.glanceSub', { asOf: asOfLabel })}
      </Typography>
      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ rowGap: 0.75 }}
      >
        <GlanceCell label={t('planner.atRisk.col.actual')} value={formatPct(metrics.fact)} />
        <GlanceCell
          label={t('planner.atRisk.col.target')}
          value={formatPct(metrics.planAtAsOf)}
        />
        <GlanceCell
          label={t('planner.atRisk.col.gap')}
          value={formatGapPp(metrics.gapPp)}
          valueColor={gapColor}
        />
        <GlanceCell
          label={t('planner.atRisk.col.baselineEnd')}
          value={`${formatPct(metrics.baseline)} → ${formatPct(metrics.end)}`}
        />
        <GlanceCell
          label={t('planner.atRisk.col.lift')}
          value={formatGapPp(metrics.liftToEnd)}
        />
      </Stack>
    </Stack>
  );
}
