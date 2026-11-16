import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import {
  PLANNER_AT_RISK_GAP_PX,
  PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT,
  PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
} from './plannerShell';

interface PlannerAtRiskDockProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  behindCount: number;
  aheadCount: number;
  /** `data-testid` of the dock (differs per planner). */
  testId: string;
  /** `data-onboarding` anchor of the dock (differs per planner). */
  onboardingId: string;
  /** Planner reserves the scrollbar gutter; TTS planner never did. */
  stableScrollbar?: boolean;
  /** At-risk table. */
  children: ReactNode;
}

/**
 * At-risk accordion docked at the bottom of the hero pane (md+: overlay, xs: in flow).
 * Geometry only; the table and its data come from the page.
 */
export function PlannerAtRiskDock({
  expanded,
  onExpandedChange,
  behindCount,
  aheadCount,
  testId,
  onboardingId,
  stableScrollbar = false,
  children,
}: PlannerAtRiskDockProps) {
  const t = useT();

  return (
    <Box
      data-testid={testId}
      data-onboarding={onboardingId}
      sx={{
        // xs: normal flow under Hero. md: bottom overlay over the pane.
        position: { xs: 'relative', md: 'absolute' },
        left: { md: 0 },
        right: { md: 0 },
        bottom: { md: PLANNER_AT_RISK_GAP_PX },
        zIndex: { md: 3 },
        flexShrink: 0,
        maxHeight: { md: PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT },
        overflow: { md: 'auto' },
        ...(stableScrollbar ? { scrollbarGutter: 'stable' } : {}),
        mt: { xs: `${PLANNER_AT_RISK_GAP_PX}px`, md: 0 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: { md: expanded ? 8 : 2 },
      }}
    >
      <Accordion
        disableGutters
        expanded={expanded}
        onChange={(_event, next) => onExpandedChange(next)}
        sx={{
          '&:before': { display: 'none' },
          boxShadow: 'none',
          bgcolor: 'transparent',
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48, py: 0.5 }}>
          <Box sx={{ minWidth: 0, pr: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {t('planner.atRiskTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {t('planner.atRisk.behindChip', { count: behindCount })}
              {' · '}
              {t('planner.atRisk.aheadChip', { count: aheadCount })}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails
          sx={{
            px: 1.5,
            pt: 0,
            pb: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            maxHeight: {
              xs: '46vh',
              md: `calc(${PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT} - ${PLANNER_AT_RISK_SUMMARY_RESERVE_PX}px)`,
            },
            overflow: 'auto',
            ...(stableScrollbar ? { scrollbarGutter: 'stable' } : {}),
          }}
        >
          {children}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
