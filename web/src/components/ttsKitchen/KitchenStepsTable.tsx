import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import { useT } from '../../i18n';
import type { KitchenBeforeAfter } from '../../schemas/ttsKitchen';

function formatSec(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

interface KitchenStepsTableProps {
  result: KitchenBeforeAfter;
}

export function KitchenStepsTable({ result }: KitchenStepsTableProps) {
  const t = useT();
  const network = result.network;
  const rows = [
    {
      key: 'before',
      label: t('kitchen.steps.before'),
      positions: network.rows_in,
      removed: 0,
      mean: network.mean_before_sec,
    },
    {
      key: 'after',
      label: t('kitchen.steps.after'),
      positions: network.rows_in - network.rows_dropped,
      removed: network.rows_dropped,
      mean: network.mean_after_sec,
    },
  ];

  return (
    <TableContainer component={Paper} variant="outlined" data-testid="kitchen-steps-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('kitchen.steps.col.step')}</TableCell>
            <TableCell align="right">{t('kitchen.steps.col.positions')}</TableCell>
            <TableCell align="right">{t('kitchen.steps.col.removed')}</TableCell>
            <TableCell align="right">{t('kitchen.steps.col.mean')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right">{row.positions.toLocaleString()}</TableCell>
              <TableCell align="right">{row.removed.toLocaleString()}</TableCell>
              <TableCell align="right">{formatSec(row.mean)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
