import { Box, Card, CardContent, Chip, Grid2 as Grid, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';

interface SimulationSummaryKpisProps {
  draftPlan: FivePercentPlan;
  approvedPlan: FivePercentPlan | null;
  monitoring: PlanMonitoringInsights | null;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDeltaPp(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pp`;
}

function MetricCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.25, px: 1.5, '&:last-child': { pb: 1.25 } }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

/** V4.2 Component C — Macro Before vs After KPI strip (quota omitted: no budget API). */
export function SimulationSummaryKpis({
  draftPlan,
  approvedPlan,
  monitoring,
}: SimulationSummaryKpisProps) {
  const baselineFinal = approvedPlan?.final_chain ?? draftPlan.current_chain;
  const projected = draftPlan.final_chain;
  const networkDelta = projected - baselineFinal;
  const behindDraft = monitoring?.summary.behind ?? null;
  const asOfLabel = monitoring
    ? periodLabel(monitoring.as_of_year, monitoring.as_of_month)
    : '—';

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <MetricCard label="Target KPI">
          <Typography variant="h6" fontWeight={700}>
            {formatPct(draftPlan.target)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Static goal
          </Typography>
        </MetricCard>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <MetricCard label="Projected network KPI">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body1" fontWeight={600}>
              {formatPct(baselineFinal)} → {formatPct(projected)}
            </Typography>
            <Chip
              size="small"
              label={formatDeltaPp(networkDelta)}
              color={networkDelta >= 0 ? 'success' : 'warning'}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {approvedPlan ? 'Accepted → draft' : 'Current → draft final'}
          </Typography>
        </MetricCard>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <MetricCard label="Stores behind plan">
          <Typography
            variant="h6"
            fontWeight={700}
            color={behindDraft != null && behindDraft > 0 ? 'warning.main' : undefined}
          >
            {behindDraft == null ? '—' : behindDraft}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            As of {asOfLabel}
          </Typography>
        </MetricCard>
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <MetricCard label="Feasibility">
          <Box>
            <Chip
              size="small"
              label={draftPlan.feasible ? 'On path' : 'May miss target'}
              color={draftPlan.feasible ? 'success' : 'warning'}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Required lift {formatDeltaPp(draftPlan.required_change)} · quota N/A
          </Typography>
        </MetricCard>
      </Grid>
    </Grid>
  );
}
