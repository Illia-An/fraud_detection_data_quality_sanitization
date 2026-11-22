import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  IconButton,
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
   * `flow` — fixed-height in-page section under Slope charts (own scroll).
   */
  placement?: 'overlay' | 'flow';
  /** At-risk table. */
  children: ReactNode;
}

function DockTitle({ behindCount, aheadCount }: { behindCount: number; aheadCount: number }) {
  const t = useT();
  return (
    <Box sx={{ minWidth: 0, pr: 1, flex: 1 }}>
      <Typography variant="body2" fontWeight={600} noWrap>
        {t('planner.atRiskTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {t('planner.atRisk.behindChip', { count: behindCount })}
        {' · '}
        {t('planner.atRisk.aheadChip', { count: aheadCount })}
      </Typography>
    </Box>
  );
}

/**
 * At-risk dock.
 * - `flow`: no MUI Accordion/Collapse — fixed 300px + internal scroll (avoids clip-without-scrollbar).
 * - `overlay`: Accordion over the hero (TTS).
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

  if (placement === 'flow') {
    return (
      <Box
        data-testid={testId}
        data-onboarding={onboardingId}
        data-placement="flow"
        data-expanded={expanded ? 'true' : 'false'}
        sx={{
          position: 'relative',
          flexShrink: 0,
          width: '100%',
          height: expanded
            ? PLANNER_AT_RISK_EXPANDED_HEIGHT_PX
            : PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
          transition: 'height 180ms ease',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...(stableScrollbar ? { scrollbarGutter: 'stable' } : {}),
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-controls={`${testId}-scroll`}
          data-testid={`${testId}-toggle`}
          onClick={() => onExpandedChange(!expanded)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onExpandedChange(!expanded);
            }
          }}
          sx={{
            flexShrink: 0,
            height: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            minHeight: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <DockTitle behindCount={behindCount} aheadCount={aheadCount} />
          <IconButton
            size="small"
            edge="end"
            tabIndex={-1}
            aria-label={expanded ? t('planner.atRiskTitle') : t('planner.atRiskTitle')}
            sx={{ pointerEvents: 'none' }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {expanded ? (
          <Box
            id={`${testId}-scroll`}
            data-testid={`${testId}-scroll`}
            sx={{
              flex: 1,
              minHeight: 0,
              px: 1.5,
              pb: 1,
              display: 'flex',
              flexDirection: 'column',
              // Bound height here; AtRiskDeltaTable's table box owns overflow:auto.
              overflow: 'hidden',
            }}
          >
            {children}
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      data-testid={testId}
      data-onboarding={onboardingId}
      data-placement="overlay"
      data-expanded={expanded ? 'true' : 'false'}
      sx={{
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
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            height: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            flexShrink: 0,
            py: 0,
            '&.Mui-expanded': {
              minHeight: PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
            },
          }}
        >
          <DockTitle behindCount={behindCount} aheadCount={aheadCount} />
        </AccordionSummary>
        <AccordionDetails
          data-testid={`${testId}-scroll`}
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
