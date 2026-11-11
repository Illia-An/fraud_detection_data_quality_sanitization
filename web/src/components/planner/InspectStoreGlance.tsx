import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { useT } from '../../i18n';
import { directionAwareDeviation, type DirectedPlan } from '../../schemas/metricScore';
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
import type { InspectSlopeAlign } from './cumulativeSlopeLayers';

interface InspectStoreGlanceProps {
  plan: DirectedPlan;
  insights: PlanMonitoringInsights;
  storeId: number;
  baselineRows: StoreBaselineRow[];
  /** Local Estimate preview for last-month end (before/without Apply). */
  draftLast: number | null;
  /**
   * When Slope sim is open: fact month / ends come from plotted curves
   * (last actual ≤ declared as_of), not raw monitoring as_of alone.
   */
  slopeAlign?: InspectSlopeAlign | null;
}

function formatScore(value: number | null, unit: string): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (unit === 'min') {
    return `${value.toFixed(2)} min`;
  }
  return `${value.toFixed(1)}%`;
}

function formatGap(value: number | null, unit: string): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  if (unit === 'min') {
    return `${sign}${Math.abs(value).toFixed(2)} min`;
  }
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
  slopeAlign = null,
}: InspectStoreGlanceProps) {
  const t = useT();
  const unit = plan.unit;
  const monitor = insights.stores.find((s) => s.store_id === storeId);
  const monitoringAsOfLabel = periodLabel(insights.as_of_year, insights.as_of_month);

  const metrics = useMemo(() => {
    const baseline = baselineScore(baselineRows, storeId);
    if (slopeAlign != null && slopeAlign.factMonth != null) {
      const fact = slopeAlign.fact;
      const planAtAsOf = slopeAlign.planAtFact;
      const gapPp = directionAwareDeviation(fact, planAtAsOf, plan.direction);
      const end = draftLast ?? slopeAlign.planEndMonthly;
      const liftToEnd =
        fact != null && end != null ? Math.round((end - fact) * 100) / 100 : null;
      return {
        factMonth: slopeAlign.factMonth,
        fact,
        planAtAsOf,
        gapPp,
        baseline,
        end,
        liftToEnd,
        eoyForecast: slopeAlign.eoyForecastCumulative,
        eoyPlanCum: slopeAlign.eoyPlanCumulative,
        aligned: true as const,
      };
    }
    const fact = monitor?.actual ?? null;
    const planAtAsOf = monitor?.planned ?? null;
    const gapPp = monitor?.deviation ?? null;
    const endFromPlan = planEndScore(plan, storeId);
    const end = draftLast ?? endFromPlan;
    const liftToEnd =
      fact != null && end != null ? Math.round((end - fact) * 100) / 100 : null;
    return {
      factMonth: monitoringAsOfLabel,
      fact,
      planAtAsOf,
      gapPp,
      baseline,
      end,
      liftToEnd,
      eoyForecast: null as number | null,
      eoyPlanCum: null as number | null,
      aligned: false as const,
    };
  }, [monitor, baselineRows, storeId, plan, draftLast, slopeAlign, monitoringAsOfLabel]);

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
        {metrics.aligned
          ? t('planner.inspect.glanceSubAligned', {
              factMonth: metrics.factMonth,
              declaredAsOf: slopeAlign?.declaredAsOfLabel ?? monitoringAsOfLabel,
            })
          : t('planner.inspect.glanceSub', { asOf: monitoringAsOfLabel })}
      </Typography>
      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ rowGap: 0.75 }}
      >
        <GlanceCell
          label={t('planner.inspect.factAsOfMonth', { month: metrics.factMonth })}
          value={formatScore(metrics.fact, unit)}
        />
        <GlanceCell
          label={t('planner.inspect.planAsOfMonth', { month: metrics.factMonth })}
          value={formatScore(metrics.planAtAsOf, unit)}
        />
        <GlanceCell
          label={unit === 'min' ? t('ttsPlanner.atRisk.col.gap') : t('planner.atRisk.col.gap')}
          value={formatGap(metrics.gapPp, unit)}
          valueColor={gapColor}
        />
        <GlanceCell
          label={
            metrics.aligned
              ? t('planner.inspect.baselinePlanEnd')
              : t('planner.atRisk.col.baselineEnd')
          }
          value={`${formatScore(metrics.baseline, unit)} → ${formatScore(metrics.end, unit)}`}
        />
        {metrics.aligned ? (
          <GlanceCell
            label={t('planner.inspect.eoyPlanCum')}
            value={formatScore(metrics.eoyPlanCum, unit)}
          />
        ) : null}
        {metrics.aligned ? (
          <GlanceCell
            label={t('planner.inspect.eoyForecast')}
            value={formatScore(metrics.eoyForecast, unit)}
          />
        ) : null}
        <GlanceCell
          label={t('planner.atRisk.col.lift')}
          value={formatGap(metrics.liftToEnd, unit)}
        />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.65rem', lineHeight: 1.3 }}
        data-testid="inspect-fact-as-of-hint"
      >
        {metrics.aligned
          ? t('planner.inspect.factAsOfHintAligned')
          : t('planner.inspect.factAsOfHint')}
      </Typography>
    </Stack>
  );
}
