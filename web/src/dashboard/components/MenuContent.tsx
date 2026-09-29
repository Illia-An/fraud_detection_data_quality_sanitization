import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
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

const mainListItems: { textKey: MessageKey; icon: ReactNode; path: string }[] = [
  { textKey: 'nav.sanitization', icon: <ScienceRoundedIcon />, path: '/' },
  { textKey: 'nav.planner', icon: <CalendarMonthRoundedIcon />, path: '/planner' },
  { textKey: 'nav.documentation', icon: <MenuBookRoundedIcon />, path: '/documentation' },
];

const secondaryListItems: { textKey: MessageKey; icon: ReactNode }[] = [
  { textKey: 'nav.about', icon: <InfoRoundedIcon /> },
];
function isSelectedPath(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/';
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

interface MenuContentProps {
  collapsed?: boolean;
}

export default function MenuContent({ collapsed = false }: MenuContentProps) {
  const location = useLocation();
  const t = useT();

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item) => {
          const label = t(item.textKey);
          const button = (
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isSelectedPath(location.pathname, item.path)}
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
        {secondaryListItems.map((item) => {
          const label = t(item.textKey);
          const button = (
            <ListItemButton
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
    </Stack>
  );
}
