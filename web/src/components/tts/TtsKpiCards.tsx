import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import type { TtsSanitizationResponse } from '../../schemas/tts';

interface TtsKpiCardsProps {
  result: TtsSanitizationResponse;
}

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

function formatSec(value: number): string {
  return `${value.toFixed(1)} s`;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} s`;
}

export function TtsKpiCards({ result }: TtsKpiCardsProps) {
  const t = useT();
  const delta = result.network_delta_sec;
  const deltaColor =
    delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'text.primary';

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
      data-testid="tts-kpi-cards"
      aria-label={t('tts.kpi.aria')}
    >
      <MiniCard>
        <Typography sx={labelSx}>{t('tts.kpi.baseline')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.baseline_mean_tts_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('tts.kpi.final')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.final_mean_tts_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('tts.kpi.delta')}</Typography>
        <Typography sx={{ ...valueSx, color: deltaColor }}>{formatDelta(delta)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('tts.kpi.config')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            label={`≥ ${result.echo_config.tts_min_sec}s`}
            sx={chipSx}
          />
          <Chip
            size="small"
            label={result.echo_config.order_agg}
            variant="outlined"
            sx={chipSx}
          />
        </Stack>
      </MiniCard>
    </Stack>
  );
}
