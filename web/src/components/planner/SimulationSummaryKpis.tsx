import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import { periodLabel } from '../../schemas/plan';
import type { DirectedPlan } from '../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';

interface SimulationSummaryKpisProps {
  draftPlan: DirectedPlan;
  monitoring: PlanMonitoringInsights | null;
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
  fontSize: '0.8rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
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

/** Macro KPI strip — cards hug content (equal L/R padding). */
export function SimulationSummaryKpis({
  draftPlan,
  monitoring,
  projectedTestId,
}: SimulationSummaryKpisProps) {
  const t = useT();
  /** Current (equal-mean @ reference) → draft Final — not approved Final→Final. */
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
      // Participate in parent glance row as a flat card stream.
      sx={{ display: 'contents' }}
    >
      <MiniCard>
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

      <MiniCard>
        <Typography sx={labelSx}>{t('planner.kpi.behind')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="baseline">
          <Typography
            sx={valueSx}
            color={behindDraft != null && behindDraft > 0 ? 'warning.main' : undefined}
          >
            {behindDraft == null ? '—' : behindDraft}
          </Typography>
          <Typography sx={{ ...labelSx, fontWeight: 400 }}>
            {t('planner.kpi.asOf', { label: asOfLabel })}
          </Typography>
        </Stack>
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{t('planner.kpi.feasibility')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={draftPlan.feasible ? t('planner.kpi.onPath') : t('planner.kpi.mayMiss')}
            color={draftPlan.feasible ? 'success' : 'warning'}
            sx={chipSx}
          />
          <Typography sx={{ ...labelSx, fontWeight: 400 }}>
            {t('planner.kpi.liftQuota', {
              lift: formatDelta(draftPlan.required_change, draftPlan.unit),
            })}
          </Typography>
        </Stack>
      </MiniCard>
    </Box>
  );
}
