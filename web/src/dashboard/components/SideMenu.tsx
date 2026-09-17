import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { BrandLogo } from './BrandLogo';
import MenuContent from './MenuContent';

export const DRAWER_WIDTH = 240;
export const DRAWER_WIDTH_COLLAPSED = 64;

export default function SideMenu() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const width = open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED;

  return (
    <MuiDrawer
      variant="permanent"
      open={open}
      sx={{
        display: { xs: 'none', md: 'block' },
        width,
        flexShrink: 0,
        boxSizing: 'border-box',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        [`& .${drawerClasses.paper}`]: {
          width,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          overflowX: 'hidden',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: open ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          gap: open ? 1 : 0.5,
          mt: 'calc(var(--template-frame-height, 0px) + 4px)',
          px: open ? 1.5 : 0.5,
          py: 1.5,
          minHeight: open ? 56 : undefined,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <BrandLogo />
          {open && (
            <Stack spacing={0} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                Survey Sanitization
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                Sanitization PoC
              </Typography>
            </Stack>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={open}
        >
          {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Divider />
      <Box
        sx={{
          overflow: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MenuContent collapsed={!open} />
      </Box>
    </MuiDrawer>
  );
}
