import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocation } from 'react-router-dom';

import { ApiStatusChip } from '../../components/layout/ApiStatusChip';
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown';
import NavbarBreadcrumbs from './NavbarBreadcrumbs';

const PAGE_HEADERS: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Survey Sanitization',
    subtitle: 'Estimate KPI impact after removing suspicious survey answers',
  },
  '/documentation': {
    title: 'Documentation',
    subtitle: 'Pipeline tiers, research reports, and API references',
  },
};

function resolvePageHeader(pathname: string): { title: string; subtitle: string } {
  return PAGE_HEADERS[pathname] ?? PAGE_HEADERS['/'];
}

export default function DashboardHeader() {
  const { pathname } = useLocation();
  const { title, subtitle } = resolvePageHeader(pathname);

  return (
    <Stack
      direction="row"
      sx={{
        display: { xs: 'none', md: 'flex' },
        width: '100%',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        maxWidth: { sm: '100%', md: '1700px' },
        pt: 1.5,
      }}
      spacing={2}
    >
      <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
        <NavbarBreadcrumbs />
      </Stack>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
        <ApiStatusChip />
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
