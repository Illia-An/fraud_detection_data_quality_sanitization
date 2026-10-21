import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import {
  formatPct,
  formatSec,
  type OrderBumpProcessResponse,
} from '../../schemas/ttsOrderBump';

interface OrderBumpKpiCardsProps {
  result: OrderBumpProcessResponse;
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

export function OrderBumpKpiCards({ result }: OrderBumpKpiCardsProps) {
  const t = useT();
  const raw = result.kpi.kitchen_mean_raw_sec ?? 0;
  const ge30 = result.kpi.kitchen_mean_ge30_sec ?? 0;
  const delta = ge30 - raw;
  const deltaColor =
    delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'text.primary';
  const deltaLabel =
    delta > 0 ? `+${delta.toFixed(1)} s` : `${delta.toFixed(1)} s`;

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      spacing={1}
      data-testid="tts-order-kpi-cards"
      aria-label={t('ttsOrder.kpi.aria')}
    >
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.bumpMeanRaw')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.kpi.kitchen_mean_raw_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.bumpMeanGe30')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.kpi.kitchen_mean_ge30_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.bumpDelta')}</Typography>
        <Typography sx={{ ...valueSx, color: deltaColor }}>{deltaLabel}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.drop')}</Typography>
        <Typography sx={valueSx}>{formatPct(result.kpi.pct_bumps_dropped_lt30)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.cycle')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.kpi.cycle_mean_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.excluded')}</Typography>
        <Typography sx={valueSx}>{formatPct(result.kpi.pct_orders_excluded_ge30)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.orderTtsEcho')}</Typography>
        <Typography sx={valueSx}>{formatSec(result.kpi.order_tts_mean_sec)}</Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.penalty')}</Typography>
        <Typography sx={valueSx}>
          {t('ttsOrder.kpi.penaltyValue', {
            penalty: result.kpi.order_tts_penalty_sec.toFixed(0),
            weight: result.kpi.order_tts_weight.toFixed(0),
          })}
        </Typography>
      </MiniCard>
      <MiniCard>
        <Typography sx={labelSx}>{t('ttsOrder.kpi.config')}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            label={`≥ ${result.echo_config.tts_min_sec}s`}
            sx={chipSx}
          />
          <Chip
            size="small"
            label={t('ttsOrder.kpi.orderVote', { count: result.kpi.order_count_ge30 })}
            variant="outlined"
            sx={chipSx}
          />
        </Stack>
      </MiniCard>
    </Stack>
  );
}
