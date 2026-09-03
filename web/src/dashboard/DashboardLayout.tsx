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
      <Box sx={{ display: 'flex' }}>
        <SideMenu />
        <AppNavbar />
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            backgroundColor: alpha(theme.palette.background.default, 1),
            overflow: 'auto',
          })}
        >
          <Stack
            spacing={3}
            sx={{
              alignItems: 'center',
              px: { xs: 2, sm: 3, md: 4 },
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <DashboardHeader />
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1800px' } }}>
              <Outlet />
            </Box>
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}
