import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { Outlet } from 'react-router-dom';

import AppTheme from '../shared-theme/AppTheme';
import AppNavbar from './components/AppNavbar';
import DashboardHeader from './components/DashboardHeader';
import SideMenu from './components/SideMenu';

export function DashboardLayout() {
  return (
    <AppTheme>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
        <SideMenu />
        <AppNavbar />
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: alpha(theme.palette.background.default, 1),
            overflow: 'hidden',
          })}
        >
          <Stack
            spacing={1}
            sx={{
              flex: 1,
              minHeight: 0,
              alignItems: 'center',
              px: { xs: 2, sm: 3, md: 4 },
              pt: { xs: 0, md: 0.5 },
              pb: { xs: 2, md: 1.5 },
              mt: { xs: 8, md: 0 },
              overflow: 'hidden',
            }}
          >
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1800px' }, flexShrink: 0 }}>
              <DashboardHeader />
            </Box>
            <Box
              sx={{
                width: '100%',
                maxWidth: { sm: '100%', md: '1800px' },
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                // Mobile: page scrolls as one column. md+: child workbench owns panes.
                overflow: { xs: 'auto', md: 'hidden' },
              }}
            >
              <Outlet />
            </Box>
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}
