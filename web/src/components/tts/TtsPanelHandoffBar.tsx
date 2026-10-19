import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { Button, Chip, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import {
  downloadTtsSanitizedPanelCsv,
  isTtsPanelReady,
  type TtsSanitizedPanel,
} from '../../schemas/ttsSanitizedPanel';

interface TtsPanelHandoffBarProps {
  panel: TtsSanitizedPanel | null;
}

/** Stage 5 — panel readiness chip + CSV export (gate signal for Stage 6). */
export function TtsPanelHandoffBar({ panel }: TtsPanelHandoffBarProps) {
  const t = useT();
  const ready = isTtsPanelReady(panel);

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      data-testid="tts-panel-handoff"
    >
      <Chip
        size="small"
        color={ready ? 'success' : 'default'}
        label={
          ready
            ? t('tts.panel.ready', { count: panel!.row_count })
            : t('tts.panel.missing')
        }
        data-testid="tts-panel-chip"
      />
      {ready && panel ? (
        <>
          <Typography variant="caption" color="text.secondary" data-testid="tts-panel-meta">
            {t('tts.panel.meta', {
              count: panel.row_count,
              ref:
                panel.reference_year != null && panel.reference_month != null
                  ? `${panel.reference_year}-${String(panel.reference_month).padStart(2, '0')}`
                  : '—',
              start: panel.period_start ?? '—',
              end: panel.period_end ? ` → ${panel.period_end}` : '',
            })}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => downloadTtsSanitizedPanelCsv(panel)}
            data-testid="tts-panel-export-csv"
          >
            {t('tts.panel.exportCsv')}
          </Button>
        </>
      ) : null}
    </Stack>
  );
}
