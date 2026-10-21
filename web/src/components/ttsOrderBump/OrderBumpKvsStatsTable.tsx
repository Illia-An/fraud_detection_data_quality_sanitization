import {
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { useT } from '../../i18n';
import {
  formatPct,
  formatSec,
  type OrderBumpKvsStats,
} from '../../schemas/ttsOrderBump';

interface OrderBumpKvsStatsTableProps {
  rows: OrderBumpKvsStats[];
  alertPct?: number;
}

export function OrderBumpKvsStatsTable({
  rows,
  alertPct = 0.2,
}: OrderBumpKvsStatsTableProps) {
  const t = useT();

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid="tts-order-kvs-empty">
        {t('ttsOrder.kvs.empty')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1} data-testid="tts-order-kvs-section">
      <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2">{t('ttsOrder.kvs.title')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('ttsOrder.kvs.subheader', { alertPct: (alertPct * 100).toFixed(0) })}
        </Typography>
      </Stack>
      <TableContainer
        component={Paper}
        variant="outlined"
        data-testid="tts-order-kvs-table"
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ttsOrder.kvs.col.kvs')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.share')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.valid')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.lt30')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.anomaly')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.meanRaw')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.meanGe30')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.median')}</TableCell>
              <TableCell align="right">{t('ttsOrder.kvs.col.lt30Sum')}</TableCell>
              <TableCell align="center">{t('ttsOrder.kvs.col.alert')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.kvs_group}
                hover
                selected={row.alert_high}
                data-testid={`tts-order-kvs-row-${row.kvs_group}`}
              >
                <TableCell>
                  {t('ttsOrder.kvs.monitor', { id: row.kvs_group })}
                </TableCell>
                <TableCell align="right">{formatPct(row.pct_of_valid_network)}</TableCell>
                <TableCell align="right">{row.bump_valid_count.toLocaleString()}</TableCell>
                <TableCell align="right">{row.bump_lt30_count.toLocaleString()}</TableCell>
                <TableCell align="right">{formatPct(row.anomaly_pct)}</TableCell>
                <TableCell align="right">{formatSec(row.bump_mean_raw_sec)}</TableCell>
                <TableCell align="right">{formatSec(row.bump_mean_ge30_sec)}</TableCell>
                <TableCell align="right">{formatSec(row.bump_median_raw_sec)}</TableCell>
                <TableCell align="right">{formatSec(row.lt30_tts_sum_sec)}</TableCell>
                <TableCell align="center">
                  {row.alert_high ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t('ttsOrder.kvs.alertYes')}
                      data-testid={`tts-order-kvs-alert-${row.kvs_group}`}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('ttsOrder.kvs.alertNo')}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
