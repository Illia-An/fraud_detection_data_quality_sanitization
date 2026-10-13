import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import TourRoundedIcon from '@mui/icons-material/TourRounded';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { useT, type MessageKey } from '../../i18n';
import { useOnboardingStore } from '../../onboarding';
import { usePlannerScenarioStore } from '../../store/plannerScenarioStore';
import { useUiStore } from '../../store/uiStore';

const mainListItems: {
  textKey: MessageKey;
  icon: ReactNode;
  path: string;
  onboarding?: string;
}[] = [
  { textKey: 'nav.sanitization', icon: <ScienceRoundedIcon />, path: '/' },
  {
    textKey: 'nav.planner',
    icon: <CalendarMonthRoundedIcon />,
    path: '/planner',
    onboarding: 'nav-planner',
  },
  { textKey: 'nav.documentation', icon: <MenuBookRoundedIcon />, path: '/documentation' },
];

function isSelectedPath(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/';
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

interface MenuContentProps {
  collapsed?: boolean;
  /** Distinguishes desktop permanent nav vs mobile drawer duplicates for tour targeting. */
  surface?: 'desktop' | 'mobile';
}

export default function MenuContent({
  collapsed = false,
  surface = 'desktop',
}: MenuContentProps) {
  const location = useLocation();
  const t = useT();
  const restart = useOnboardingStore((s) => s.restart);
  const processResult = useUiStore((s) => s.processResult);
  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);

  const handleRestartTour = () => {
    restart({
      hasProcessResult: processResult != null,
      hasPlannerPanel: processResult != null || draftPlan != null,
      hasDraftPlan: draftPlan != null,
    });
  };

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense data-onboarding="nav-main" data-onboarding-surface={surface}>
        {mainListItems.map((item) => {
          const label = t(item.textKey);
          const button = (
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isSelectedPath(location.pathname, item.path)}
              {...(item.onboarding
                ? {
                    'data-onboarding': item.onboarding,
                    'data-onboarding-surface': surface,
                  }
                : {})}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1 : 2,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 40,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={label} />}
            </ListItemButton>
          );

          return (
            <ListItem key={item.textKey} disablePadding sx={{ display: 'block' }}>
              {collapsed ? (
                <Tooltip title={label} placement="right">
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>
      <List dense>
        <ListItem disablePadding sx={{ display: 'block' }}>
          {collapsed ? (
            <Tooltip title={t('nav.tour')} placement="right">
              <ListItemButton
                onClick={handleRestartTour}
                data-testid="nav-restart-tour"
                sx={{ justifyContent: 'center', px: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                  <TourRoundedIcon />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ) : (
            <ListItemButton onClick={handleRestartTour} data-testid="nav-restart-tour" sx={{ px: 2 }}>
              <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                <TourRoundedIcon />
              </ListItemIcon>
              <ListItemText primary={t('nav.tour')} />
            </ListItemButton>
          )}
        </ListItem>
        <ListItem disablePadding sx={{ display: 'block' }}>
          {collapsed ? (
            <Tooltip title={t('nav.about')} placement="right">
              <ListItemButton sx={{ justifyContent: 'center', px: 1 }}>
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                  <InfoRoundedIcon />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          ) : (
            <ListItemButton sx={{ px: 2 }}>
              <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                <InfoRoundedIcon />
              </ListItemIcon>
              <ListItemText primary={t('nav.about')} />
            </ListItemButton>
          )}
        </ListItem>
      </List>
    </Stack>
  );
}
