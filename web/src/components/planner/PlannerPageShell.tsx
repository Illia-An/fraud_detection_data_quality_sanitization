import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import { PLANNER_RAIL_COLLAPSED_PX, PLANNER_RAIL_WIDTH_PX } from './plannerShell';

interface PlannerPageShellProps {
  controlsOpen: boolean;
  onToggleControls: () => void;
  /** `data-testid` of the controls rail (differs per planner). */
  railTestId: string;
  /** Collapsed Play is rendered only while the rail is closed and this is true. */
  showCollapsedPlay?: boolean;
  /** Collapsed Play content (button); the shell only owns its column layout. */
  collapsedPlay?: ReactNode;
  /** Controls rail content. Stays mounted when collapsed so form state is preserved. */
  rail: ReactNode;
  /** Main column content. */
  children: ReactNode;
}

/**
 * Layout frame shared by `PlannerPage` and `TtsPlannerPage`: controls rail with
 * collapse toggle, optional collapsed Play slot, and the main column.
 * Layout only: no data fetching, no plan logic.
 */
export function PlannerPageShell({
  controlsOpen,
  onToggleControls,
  railTestId,
  showCollapsedPlay = false,
  collapsedPlay = null,
  rail,
  children,
}: PlannerPageShellProps) {
  const t = useT();
  const theme = useTheme();
  const railWidth = controlsOpen ? PLANNER_RAIL_WIDTH_PX : PLANNER_RAIL_COLLAPSED_PX;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flex: 1,
        minHeight: 0,
        height: { xs: 'auto', md: '100%' },
        overflow: { xs: 'auto', md: 'hidden' },
        gap: { xs: 2, md: 0 },
      }}
    >
      <Box
        component="aside"
        data-testid={railTestId}
        data-collapsed={controlsOpen ? 'false' : 'true'}
        sx={{
          width: { xs: '100%', md: railWidth },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: { md: 0 },
          overflow: { md: 'hidden' },
          borderRight: { md: 1 },
          borderColor: { md: 'divider' },
          pr: { md: controlsOpen ? 2 : 0.5 },
          mr: { md: controlsOpen ? 2 : 1 },
          transition: theme.transitions.create(['width', 'padding', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            justifyContent: controlsOpen ? 'flex-end' : 'center',
            flexShrink: 0,
            pb: 0.5,
          }}
        >
          <Tooltip
            title={controlsOpen ? t('common.collapseControls') : t('common.expandControls')}
            placement="right"
          >
            <IconButton
              size="small"
              onClick={onToggleControls}
              aria-label={
                controlsOpen ? t('common.collapseControls') : t('common.expandControls')
              }
              aria-expanded={controlsOpen}
            >
              {controlsOpen ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Keep mounted when collapsed so form state is preserved. */}
        <Box
          sx={{
            display: { xs: 'flex', md: controlsOpen ? 'flex' : 'none' },
            flexDirection: 'column',
            flex: { md: 1 },
            minHeight: { md: 0 },
            overflowY: { xs: 'visible', md: 'hidden' },
            overflowX: 'hidden',
            gap: 1.5,
            pb: 1,
          }}
        >
          {rail}
        </Box>

        {!controlsOpen && showCollapsedPlay && collapsedPlay != null ? (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              pt: 1,
              flex: 1,
            }}
          >
            {collapsedPlay}
          </Box>
        ) : null}
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: { xs: 'auto', md: 'hidden' },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          pb: { xs: 2, md: 0 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
