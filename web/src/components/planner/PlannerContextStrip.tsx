import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import type { ProcessResponse } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { PlannerBaselineBadge } from './PlannerBaselineBadge';

export interface PlannerContextStripProps {
  panel: SanitizedPanel | null;
  processResult: ProcessResponse | null;
  baselineReady: boolean;
  draftPlan: FivePercentPlan;
  horizonMonths: number;
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

/**
 * Context strip — cards hug content (equal L/R padding); row distributes leftover space.
 */
export function PlannerContextStrip({
  panel,
  processResult,
  baselineReady,
  draftPlan,
  horizonMonths,
}: PlannerContextStripProps) {
  const t = useT();

  return (
    <Box
      data-testid="planner-context-strip"
      // Participate in parent glance row as a flat card stream.
      sx={{ display: 'contents' }}
    >
      <MiniCard>
        <Box
          sx={{
            '& .MuiChip-root': {
              height: 22,
              fontSize: '0.7rem',
              maxWidth: '100%',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                px: 0.75,
              },
            },
            '& .MuiIconButton-root': { p: 0.25 },
          }}
        >
          <PlannerBaselineBadge
            panel={panel}
            processResult={processResult}
            baselineReady={baselineReady}
          />
        </Box>
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{t('planner.strip.horizonLabel')}</Typography>
        <Typography sx={valueSx}>
          {t('planner.strip.horizonValue', { months: horizonMonths })}
        </Typography>
      </MiniCard>

      <MiniCard>
        <Typography sx={labelSx}>{t('planner.strip.targetLabel')}</Typography>
        <Typography sx={valueSx}>{draftPlan.target.toFixed(1)}%</Typography>
      </MiniCard>
    </Box>
  );
}
