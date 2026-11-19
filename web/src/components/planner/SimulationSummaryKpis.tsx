import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import { periodLabel } from '../../schemas/plan';
import type { DirectedPlan } from '../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import {
  FIGMA_FONT_MONO,
  FIGMA_KPI_CARD_PADDING_PX,
  FIGMA_KPI_PRIMARY_WIDTH_PX,
  FIGMA_KPI_STRIP_HEIGHT_PX,
} from './figmaPlannerLayout';

interface SimulationSummaryKpisProps {
  draftPlan: DirectedPlan;
  monitoring: PlanMonitoringInsights | null;
  /** Optional horizon override; defaults to chain_trajectory length. */
  horizonMonths?: number;
  projectedTestId?: string;
}

function formatScore(value: number, unit: string): string {
  return unit === 'min' ? `${value.toFixed(2)} min` : `${value.toFixed(2)}%`;
}

function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? '+' : '';
  return unit === 'min' ? `${sign}${value.toFixed(2)} min` : `${sign}${value.toFixed(2)} pp`;
}

const labelSx = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'text.secondary',
  lineHeight: 1.2,
} as const;

const valueSx = {
  fontFamily: FIGMA_FONT_MONO,
  fontSize: '1.25rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: '28px',
} as const;

const detailSx = {
  fontSize: '0.7rem',
  fontWeight: 400,
  color: 'text.secondary',
  lineHeight: 1.2,
} as const;

const chipSx = {
  height: 22,
  fontSize: '0.7rem',
  fontWeight: 600,
  '& .MuiChip-label': { px: 0.75 },
} as const;

function KpiCard({
  primary,
  children,
  testId,
}: {
  primary?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        flex: primary ? `0 0 ${FIGMA_KPI_PRIMARY_WIDTH_PX}px` : '1 1 0',
        width: primary ? FIGMA_KPI_PRIMARY_WIDTH_PX : undefined,
        minWidth: 0,
        height: '100%',
        px: `${FIGMA_KPI_CARD_PADDING_PX}px`,
        py: `${FIGMA_KPI_CARD_PADDING_PX}px`,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '4px',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Figma §3.2 — full-width evaluation status strip:
 * primary 340px + four equal secondary cards; left-aligned content.
 */
export function SimulationSummaryKpis({
  draftPlan,
  monitoring,
  horizonMonths,
  projectedTestId,
}: SimulationSummaryKpisProps) {
  const t = useT();
  const current = draftPlan.current_chain;
  const projected = draftPlan.final_chain;
  const networkDelta = projected - current;
  const improved =
    draftPlan.direction === 'lower_is_better' ? networkDelta <= 1e-9 : networkDelta >= -1e-9;
  const behindDraft = monitoring?.summary.behind ?? null;
  const asOfLabel = monitoring
    ? periodLabel(monitoring.as_of_year, monitoring.as_of_month)
    : '—';
  const horizon =
    horizonMonths ??
    (draftPlan.chain_trajectory.length > 0 ? draftPlan.chain_trajectory.length : null);

  return (
    <Box
      data-testid="planner-kpi-strip"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        minHeight: FIGMA_KPI_STRIP_HEIGHT_PX,
        height: FIGMA_KPI_STRIP_HEIGHT_PX,
        flexShrink: 0,
        gap: 0,
        overflow: 'hidden',
      }}
    >
      <KpiCard primary testId="planner-kpi-projected">
        <Typography sx={labelSx}>{t('planner.kpi.projected')}</Typography>
        <Typography sx={valueSx} data-testid={projectedTestId}>
          {formatScore(current, draftPlan.unit)} → {formatScore(projected, draftPlan.unit)}
        </Typography>
        <Chip
          size="small"
          label={formatDelta(networkDelta, draftPlan.unit)}
          color={improved ? 'success' : 'warning'}
          sx={chipSx}
        />
      </KpiCard>

      <KpiCard testId="planner-kpi-horizon">
        <Typography sx={labelSx}>{t('planner.kpi.horizon')}</Typography>
        <Typography sx={valueSx}>
          {horizon == null ? '—' : t('planner.kpi.horizonMonths', { count: horizon })}
        </Typography>
        <Typography sx={detailSx}>{t('planner.kpi.horizonDetail')}</Typography>
      </KpiCard>

      <KpiCard testId="planner-kpi-target">
        <Typography sx={labelSx}>{t('planner.kpi.target')}</Typography>
        <Typography sx={valueSx}>{formatScore(draftPlan.target, draftPlan.unit)}</Typography>
        <Typography sx={detailSx}>{t('planner.kpi.targetDetail')}</Typography>
      </KpiCard>

      <KpiCard testId="planner-kpi-behind">
        <Typography sx={labelSx}>{t('planner.kpi.behind')}</Typography>
        <Typography
          sx={{
            ...valueSx,
            color: behindDraft != null && behindDraft > 0 ? 'warning.main' : undefined,
          }}
        >
          {behindDraft == null ? '—' : behindDraft}
        </Typography>
        <Typography sx={detailSx}>{t('planner.kpi.asOf', { label: asOfLabel })}</Typography>
      </KpiCard>

      <KpiCard testId="planner-kpi-feasibility">
        <Typography sx={labelSx}>{t('planner.kpi.feasibility')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={draftPlan.feasible ? t('planner.kpi.onPath') : t('planner.kpi.mayMiss')}
            color={draftPlan.feasible ? 'success' : 'warning'}
            sx={chipSx}
          />
        </Stack>
        <Typography sx={detailSx}>
          {t('planner.kpi.liftQuota', {
            lift: formatDelta(draftPlan.required_change, draftPlan.unit),
          })}
        </Typography>
      </KpiCard>
    </Box>
  );
}
