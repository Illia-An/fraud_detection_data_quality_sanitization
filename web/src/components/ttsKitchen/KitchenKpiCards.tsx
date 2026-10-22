import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import type { KitchenBeforeAfter } from '../../schemas/ttsKitchen';

const labelSx = {
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'text.secondary',
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
} as const;

const valueSx = {
  fontSize: '0.8rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
} as const;

const chipSx = {
  height: 18,
  fontSize: '0.65rem',
  fontWeight: 600,
  '& .MuiChip-label': { px: 0.6 },
} as const;

function MiniCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: 'fit-content',
        maxWidth: '100%',
        flex: '0 1 auto',
        px: 1,
        py: 0.5,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.15,
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

function formatSec(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

function formatDelta(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} s`;
}

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(2)}%`;
}

function deltaChipColor(value: number | null): 'default' | 'success' | 'error' {
  if (value == null || Number.isNaN(value) || value === 0) {
    return 'default';
  }
  return value > 0 ? 'success' : 'error';
}

interface KitchenKpiCardsProps {
  result: KitchenBeforeAfter;
}

export function KitchenKpiCards({ result }: KitchenKpiCardsProps) {
  const t = useT();
  const delta = result.network.delta_sec;
  const volume = `${result.network.rows_in.toLocaleString()} · ${result.network.rows_dropped.toLocaleString()} · ${formatPct(result.network.pct_dropped)}`;

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={0.75}
      data-testid="kitchen-kpi-cards"
      aria-label={t('kitchen.kpi.aria')}
      sx={{ flexShrink: 0, alignItems: 'stretch' }}
    >
      <MiniCard>
        <Typography sx={labelSx}>{t('kitchen.kpi.before')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.network.mean_before_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('kitchen.kpi.after')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap>
          <Typography sx={valueSx}>{formatSec(result.network.mean_after_sec)}</Typography>
          <Chip
            size="small"
            label={t('kitchen.kpi.threshold', { sec: result.tts_min_sec })}
            sx={chipSx}
            data-testid="kitchen-threshold-chip"
          />
        </Stack>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('kitchen.kpi.delta')}</Typography>
        <Chip
          size="small"
          label={formatDelta(delta)}
          color={deltaChipColor(delta)}
          data-testid="kitchen-delta-chip"
          sx={chipSx}
        />
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('kitchen.kpi.input')}</Typography>
        <Typography sx={valueSx}>{volume}</Typography>
      </MiniCard>
    </Stack>
  );
}
