import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocation } from 'react-router-dom';

import { ApiStatusChip } from '../../components/layout/ApiStatusChip';
import { LanguageToggle, useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown';

const PAGE_HEADER_KEYS: Record<string, { title: MessageKey; subtitle: MessageKey }> = {
  '/': {
    title: 'header.sanitization.title',
    subtitle: 'header.sanitization.subtitle',
  },
  '/planner': {
    title: 'header.planner.title',
    subtitle: 'header.planner.subtitle',
  },
  '/documentation': {
    title: 'header.documentation.title',
    subtitle: 'header.documentation.subtitle',
  },
};

function resolvePageHeaderKeys(pathname: string): { title: MessageKey; subtitle: MessageKey } {
  return PAGE_HEADER_KEYS[pathname] ?? PAGE_HEADER_KEYS['/'];
}

export default function DashboardHeader() {
  const { pathname } = useLocation();
  const t = useT();
  const keys = resolvePageHeaderKeys(pathname);

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
          {t(keys.title)}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {t(keys.subtitle)}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
        <ApiStatusChip />
        <LanguageToggle />
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
