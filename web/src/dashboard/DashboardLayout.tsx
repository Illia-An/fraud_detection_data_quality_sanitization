import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { Outlet, useLocation } from 'react-router-dom';

import { LocaleDocumentEffects } from '../i18n/LocaleDocumentEffects';
import { OnboardingHost } from '../onboarding';
import AppTheme from '../shared-theme/AppTheme';
import AppNavbar from './components/AppNavbar';
import DashboardHeader from './components/DashboardHeader';
import SideMenu from './components/SideMenu';

function isPlannerRoute(pathname: string): boolean {
  return pathname === '/planner' || pathname.startsWith('/planner/');
}

function isTtsPlannerRoute(pathname: string): boolean {
  return pathname === '/planner-tts' || pathname.startsWith('/planner-tts/');
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  const tightNavPad = isPlannerRoute(pathname) || isTtsPlannerRoute(pathname);

  return (
    <LocaleDocumentEffects>
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
              spacing={tightNavPad ? 0 : 1}
              sx={{
                flex: 1,
                minHeight: 0,
                alignItems: tightNavPad ? 'stretch' : 'center',
                // Figma §1.1: gapless shell for Planner / TTS Planner; other pages keep gutters.
                pl: tightNavPad ? 0 : { xs: 2, sm: 3, md: 4 },
                pr: tightNavPad ? 0 : { xs: 2, sm: 3, md: 4 },
                pt: tightNavPad ? 0 : { xs: 0, md: 0.5 },
                pb: tightNavPad ? 0 : { xs: 2, md: 1.5 },
                mt: { xs: 8, md: 0 },
                overflow: 'hidden',
              }}
            >
              {!tightNavPad ? (
                <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1800px' }, flexShrink: 0 }}>
                  <DashboardHeader />
                </Box>
              ) : (
                <Box sx={{ width: '100%', flexShrink: 0, px: 2, pt: 0.5 }}>
                  <DashboardHeader />
                </Box>
              )}
              <Box
                sx={{
                  width: '100%',
                  maxWidth: tightNavPad ? 'none' : { sm: '100%', md: '1800px' },
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
          <OnboardingHost />
        </Box>
      </AppTheme>
    </LocaleDocumentEffects>
  );
}
