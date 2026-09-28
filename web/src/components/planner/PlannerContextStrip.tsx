import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

import type { ProcessResponse } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { PlannerBaselineBadge } from './PlannerBaselineBadge';
import { computeNetworkSlack } from './plannerSlack';

export interface PlannerContextStripProps {
  panel: SanitizedPanel | null;
  processResult: ProcessResponse | null;
  baselineReady: boolean;
  draftPlan: FivePercentPlan;
  horizonMonths: number;
}

/**
 * Datadog SLO-style header context strip: baseline gate + glance badges + network slack bar.
 */
export function PlannerContextStrip({
  panel,
  processResult,
  baselineReady,
  draftPlan,
  horizonMonths,
}: PlannerContextStripProps) {
  const slack = computeNetworkSlack(
    draftPlan.target,
    draftPlan.current_chain,
    draftPlan.final_chain,
  );
  const progressPct = Math.round(slack.progress01 * 100);
  const barColor =
    slack.remainingPp > 0.05 ? 'warning' : slack.remainingPp < -0.05 ? 'success' : 'primary';

  return (
    <Box
      data-testid="planner-context-strip"
      role="region"
      aria-label="Planner context"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'center' },
        gap: 1.5,
        flexWrap: 'wrap',
        px: 1.5,
        py: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <PlannerBaselineBadge
        panel={panel}
        processResult={processResult}
        baselineReady={baselineReady}
      />

      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Horizon: ${horizonMonths} mo`} />
        <Chip size="small" variant="outlined" label={`Target: ${draftPlan.target.toFixed(1)}%`} />
        <Chip
          size="small"
          color={draftPlan.feasible ? 'success' : 'warning'}
          variant="outlined"
          label={`Status: Projected ${draftPlan.final_chain.toFixed(1)}%`}
        />
      </Stack>

      <Box
        sx={{
          flex: 1,
          minWidth: { xs: '100%', md: 160 },
          maxWidth: { md: 280 },
          ml: { md: 'auto' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.25 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Network slack
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {slack.statusLabel}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          color={barColor}
          aria-label={`Network slack progress ${progressPct}%`}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>
    </Box>
  );
}
