import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocation } from 'react-router-dom';

import { ApiStatusChip } from '../../components/layout/ApiStatusChip';
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown';

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
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: { sm: '100%', md: '1700px' },
        pt: 0.5,
        pb: 0,
      }}
      spacing={1}
    >
      <Stack spacing={0} sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography component="h1" variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
        <ApiStatusChip />
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
