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
import {
  ORDER_BUMP_STEP_LABELS,
  formatSec,
  type OrderBumpStepMetric,
} from '../../schemas/ttsOrderBump';

interface OrderBumpStepsTableProps {
  steps: OrderBumpStepMetric[];
}

export function OrderBumpStepsTable({ steps }: OrderBumpStepsTableProps) {
  const t = useT();

  if (steps.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('ttsOrder.steps.empty')}
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" data-testid="tts-order-steps-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('ttsOrder.steps.col.step')}</TableCell>
            <TableCell align="right">{t('ttsOrder.steps.col.in')}</TableCell>
            <TableCell align="right">{t('ttsOrder.steps.col.out')}</TableCell>
            <TableCell align="right">{t('ttsOrder.steps.col.dropped')}</TableCell>
            <TableCell align="right">{t('ttsOrder.steps.col.mean')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((step) => (
            <TableRow key={step.step_name}>
              <TableCell>{ORDER_BUMP_STEP_LABELS[step.step_name]}</TableCell>
              <TableCell align="right">{step.rows_in.toLocaleString()}</TableCell>
              <TableCell align="right">{step.rows_out.toLocaleString()}</TableCell>
              <TableCell align="right">{step.rows_dropped.toLocaleString()}</TableCell>
              <TableCell align="right">{formatSec(step.mean_tts_sec)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
