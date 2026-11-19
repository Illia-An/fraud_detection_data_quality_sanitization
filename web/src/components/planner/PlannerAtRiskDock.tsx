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
  PLANNER_AT_RISK_EXPANDED_HEIGHT_PX,
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
  /**
   * `overlay` — md+ absolute over hero (TTS / legacy).
   * `flow` — normal document flow under charts (network Planner).
   */
  placement?: 'overlay' | 'flow';
  /** At-risk table. */
  children: ReactNode;
}

/**
 * At-risk accordion: overlay (md+) or in-flow table section under Slope charts.
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
  placement = 'overlay',
  children,
}: PlannerAtRiskDockProps) {
  const t = useT();
  const inFlow = placement === 'flow';

  return (
    <Box
      data-testid={testId}
      data-onboarding={onboardingId}
      data-placement={placement}
      sx={
        inFlow
          ? {
              position: 'relative',
              flexShrink: 0,
              width: '100%',
              height: expanded ? PLANNER_AT_RISK_EXPANDED_HEIGHT_PX : PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
              mt: 0,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              boxShadow: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              ...(stableScrollbar ? { scrollbarGutter: 'stable' } : {}),
            }
          : {
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
            }
      }
    >
      <Accordion
        disableGutters
        expanded={expanded}
        onChange={(_event, next) => onExpandedChange(next)}
        sx={{
          '&:before': { display: 'none' },
          boxShadow: 'none',
          bgcolor: 'transparent',
          height: inFlow ? '100%' : undefined,
          display: inFlow ? 'flex' : undefined,
          flexDirection: inFlow ? 'column' : undefined,
          '& .MuiAccordionDetails-root': inFlow
            ? { flex: 1, minHeight: 0 }
            : undefined,
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            height: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            py: 0,
            px: inFlow ? 2 : undefined,
            '&.Mui-expanded': {
              minHeight: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            },
          }}
        >
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
          sx={
            inFlow
              ? {
                  px: 1.5,
                  pt: 0,
                  pb: 1,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  // Figma: six-row preview lives inside the 421 px section.
                  overflow: 'auto',
                  ...(stableScrollbar ? { scrollbarGutter: 'stable' } : {}),
                }
              : {
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
                }
          }
        >
          {children}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
