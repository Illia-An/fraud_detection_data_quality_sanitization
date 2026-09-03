import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const mainListItems = [
  { text: 'Sanitization', icon: <ScienceRoundedIcon />, path: '/' },
  { text: 'Documentation', icon: <MenuBookRoundedIcon />, path: '/documentation' },
];

const secondaryListItems = [{ text: 'About PoC', icon: <InfoRoundedIcon /> }];

function isSelectedPath(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/';
  }
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export default function MenuContent() {
  const location = useLocation();

  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isSelectedPath(location.pathname, item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List dense>
        {secondaryListItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
            <ListItemButton>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
