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
  '/tts-kitchen': {
    title: 'header.ttsKitchen.title',
    subtitle: 'header.ttsKitchen.subtitle',
  },
  '/planner': {
    title: 'header.planner.title',
    subtitle: 'header.planner.subtitle',
  },
  '/planner-tts': {
    title: 'header.ttsPlanner.title',
    subtitle: 'header.ttsPlanner.subtitle',
  },
  '/documentation': {
    title: 'header.documentation.title',
    subtitle: 'header.documentation.subtitle',
  },
};

function resolvePageHeaderKeys(pathname: string): { title: MessageKey; subtitle: MessageKey } {
  if (pathname.startsWith('/planner/store/')) {
    return PAGE_HEADER_KEYS['/planner'];
  }
  return PAGE_HEADER_KEYS[pathname] ?? PAGE_HEADER_KEYS['/'];
}

interface DashboardHeaderProps {
  /** Planner workbenches: single-line title, no subtitle (saves vertical chrome). */
  compact?: boolean;
}

export default function DashboardHeader({ compact = false }: DashboardHeaderProps) {
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
        pt: compact ? 0 : 0.5,
        pb: 0,
        minHeight: compact ? 32 : undefined,
      }}
      spacing={1}
    >
      <Stack
        direction={compact ? 'row' : 'column'}
        spacing={compact ? 1 : 0}
        alignItems={compact ? 'baseline' : undefined}
        sx={{ flexGrow: 1, minWidth: 0 }}
      >
        <Typography
          component="h1"
          variant={compact ? 'subtitle2' : 'subtitle1'}
          sx={{ fontWeight: 600, lineHeight: 1.2 }}
        >
          {t(keys.title)}
        </Typography>
        {!compact ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {t(keys.subtitle)}
          </Typography>
        ) : null}
      </Stack>
      <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
        <ApiStatusChip />
        <LanguageToggle />
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
