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
  type OrderBumpStoreAnomaly,
} from '../../schemas/ttsOrderBump';

interface OrderBumpStoreAnomalyTableProps {
  rows: OrderBumpStoreAnomaly[];
  alertPct?: number;
}

export function OrderBumpStoreAnomalyTable({
  rows,
  alertPct = 0.2,
}: OrderBumpStoreAnomalyTableProps) {
  const t = useT();
  const alertCount = rows.filter((row) => row.alert_high).length;

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid="tts-order-anomaly-empty">
        {t('ttsOrder.anomaly.empty')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1} data-testid="tts-order-anomaly-section">
      <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2">{t('ttsOrder.anomaly.title')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('ttsOrder.anomaly.subheader', {
            alertPct: (alertPct * 100).toFixed(0),
            alertCount,
          })}
        </Typography>
      </Stack>
      <TableContainer
        component={Paper}
        variant="outlined"
        data-testid="tts-order-anomaly-table"
        sx={{ maxHeight: 280 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('ttsOrder.anomaly.col.store')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.anomaly')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.lt30')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.valid')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.orders')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.orderRaw')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.orderAfter')}</TableCell>
              <TableCell align="right">{t('ttsOrder.anomaly.col.delta')}</TableCell>
              <TableCell align="center">{t('ttsOrder.anomaly.col.alert')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.store_id}
                hover
                selected={row.alert_high}
                data-testid={`tts-order-anomaly-row-${row.store_id}`}
              >
                <TableCell>{row.store_id}</TableCell>
                <TableCell align="right">{formatPct(row.anomaly_pct)}</TableCell>
                <TableCell align="right">{row.bump_lt30_count.toLocaleString()}</TableCell>
                <TableCell align="right">{row.bump_valid_count.toLocaleString()}</TableCell>
                <TableCell align="right">{row.order_count.toLocaleString()}</TableCell>
                <TableCell align="right">{formatSec(row.order_tts_mean_sec)}</TableCell>
                <TableCell align="right">{formatSec(row.order_tts_mean_after_sec)}</TableCell>
                <TableCell align="right">{formatSec(row.order_tts_delta_sec)}</TableCell>
                <TableCell align="center">
                  {row.alert_high ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t('ttsOrder.anomaly.alertYes')}
                      data-testid={`tts-order-anomaly-alert-${row.store_id}`}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('ttsOrder.anomaly.alertNo')}
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
