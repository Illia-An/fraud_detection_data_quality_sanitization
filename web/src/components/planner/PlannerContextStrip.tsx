import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
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
  const t = useT();
  const slack = computeNetworkSlack(
    draftPlan.target,
    draftPlan.current_chain,
    draftPlan.final_chain,
  );
  const progressPct = Math.round(slack.progress01 * 100);
  const barColor =
    slack.remainingPp > 0.05 ? 'warning' : slack.remainingPp < -0.05 ? 'success' : 'primary';

  let slackStatusLabel: string;
  if (slack.remainingPp > 0.05) {
    slackStatusLabel = t('planner.strip.slackTo', { pp: slack.remainingPp.toFixed(1) });
  } else if (slack.remainingPp < -0.05) {
    slackStatusLabel = t('planner.strip.slackAhead', {
      pp: Math.abs(slack.remainingPp).toFixed(1),
    });
  } else {
    slackStatusLabel = t('planner.strip.atTarget');
  }

  return (
    <Box
      data-testid="planner-context-strip"
      role="region"
      aria-label={t('planner.strip.aria')}
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
        <Chip
          size="small"
          variant="outlined"
          label={t('planner.strip.horizon', { months: horizonMonths })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('planner.strip.target', { target: draftPlan.target.toFixed(1) })}
        />
        <Chip
          size="small"
          color={draftPlan.feasible ? 'success' : 'warning'}
          variant="outlined"
          label={t('planner.strip.status', { pct: draftPlan.final_chain.toFixed(1) })}
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
            {t('planner.strip.slack')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {slackStatusLabel}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          color={barColor}
          aria-label={t('planner.strip.progressAria', { pct: progressPct })}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>
    </Box>
  );
}
