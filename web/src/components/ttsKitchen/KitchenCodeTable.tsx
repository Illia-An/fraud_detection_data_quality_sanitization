import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { useT } from '../../i18n';
import { sortKitchenMeitByDropped, type KitchenBeforeAfter } from '../../schemas/ttsKitchen';

function formatSec(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(2)}%`;
}

interface KitchenCodeTableProps {
  result: KitchenBeforeAfter;
}

export function KitchenCodeTable({ result }: KitchenCodeTableProps) {
  const t = useT();
  const rows = sortKitchenMeitByDropped(result.by_meit);

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('kitchen.code.empty')}
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" data-testid="kitchen-code-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('kitchen.code.col.code')}</TableCell>
            <TableCell align="right">{t('kitchen.code.col.in')}</TableCell>
            <TableCell align="right">{t('kitchen.code.col.removed')}</TableCell>
            <TableCell align="right">{t('kitchen.code.col.pct')}</TableCell>
            <TableCell align="right">{t('kitchen.code.col.before')}</TableCell>
            <TableCell align="right">{t('kitchen.code.col.after')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.meit_number} data-testid={`kitchen-code-row-${row.meit_number}`}>
              <TableCell>{row.meit_number}</TableCell>
              <TableCell align="right">{row.rows_in.toLocaleString()}</TableCell>
              <TableCell align="right">{row.rows_dropped.toLocaleString()}</TableCell>
              <TableCell align="right">{formatPct(row.pct_dropped)}</TableCell>
              <TableCell align="right">{formatSec(row.mean_before_sec)}</TableCell>
              <TableCell align="right">{formatSec(row.mean_after_sec)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
