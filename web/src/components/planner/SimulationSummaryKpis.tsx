import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import { periodLabel } from '../../schemas/plan';
import type { DirectedPlan } from '../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { FIGMA_FONT_MONO } from './figmaPlannerLayout';

interface SimulationSummaryKpisProps {
  draftPlan: DirectedPlan;
  monitoring: PlanMonitoringInsights | null;
  /** Optional horizon override (unused in strip — Horizon lives on context strip). */
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
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'text.secondary',
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
} as const;

const valueSx = {
  fontFamily: FIGMA_FONT_MONO,
  fontSize: '0.8rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
} as const;

const detailSx = {
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

function MiniCard({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <Box
      data-testid={testId}
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

/**
 * Compact evaluation KPIs (no Horizon/Target — those stay on PlannerContextStrip).
 * Designed to sit in the same row as baseline / answer chips.
 */
export function SimulationSummaryKpis({
  draftPlan,
  monitoring,
  horizonMonths: _horizonMonths,
  projectedTestId,
}: SimulationSummaryKpisProps) {
  void _horizonMonths;
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

  return (
    <Box
      data-testid="planner-kpi-strip"
      sx={{
        display: 'contents',
      }}
    >
      <MiniCard testId="planner-kpi-projected">
        <Typography sx={labelSx}>{t('planner.kpi.projected')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={valueSx} data-testid={projectedTestId}>
            {formatScore(current, draftPlan.unit)} → {formatScore(projected, draftPlan.unit)}
          </Typography>
          <Chip
            size="small"
            label={formatDelta(networkDelta, draftPlan.unit)}
            color={improved ? 'success' : 'warning'}
            sx={chipSx}
          />
        </Stack>
      </MiniCard>

      <MiniCard testId="planner-kpi-behind">
        <Typography sx={labelSx}>{t('planner.kpi.behind')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="baseline">
          <Typography
            sx={{
              ...valueSx,
              color: behindDraft != null && behindDraft > 0 ? 'warning.main' : undefined,
            }}
          >
            {behindDraft == null ? '—' : behindDraft}
          </Typography>
          <Typography sx={detailSx}>{t('planner.kpi.asOf', { label: asOfLabel })}</Typography>
        </Stack>
      </MiniCard>

      <MiniCard testId="planner-kpi-feasibility">
        <Typography sx={labelSx}>{t('planner.kpi.feasibility')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={draftPlan.feasible ? t('planner.kpi.onPath') : t('planner.kpi.mayMiss')}
            color={draftPlan.feasible ? 'success' : 'warning'}
            sx={chipSx}
          />
          <Typography sx={detailSx}>
            {t('planner.kpi.liftQuota', {
              lift: formatDelta(draftPlan.required_change, draftPlan.unit),
            })}
          </Typography>
        </Stack>
      </MiniCard>
    </Box>
  );
}
