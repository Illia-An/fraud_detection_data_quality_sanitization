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
  sortTtsSteps,
  TTS_STEP_LABELS,
  type TtsStepMetric,
} from '../../schemas/tts';

interface TtsStepsTableProps {
  steps: TtsStepMetric[];
}

function formatSec(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

export function TtsStepsTable({ steps }: TtsStepsTableProps) {
  const t = useT();
  const ordered = sortTtsSteps(steps);

  if (ordered.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('tts.steps.empty')}
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" data-testid="tts-steps-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('tts.steps.col.step')}</TableCell>
            <TableCell align="right">{t('tts.steps.col.in')}</TableCell>
            <TableCell align="right">{t('tts.steps.col.out')}</TableCell>
            <TableCell align="right">{t('tts.steps.col.dropped')}</TableCell>
            <TableCell align="right">{t('tts.steps.col.mean')}</TableCell>
            <TableCell align="right">{t('tts.steps.col.median')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ordered.map((step) => (
            <TableRow key={step.step_name}>
              <TableCell>{TTS_STEP_LABELS[step.step_name]}</TableCell>
              <TableCell align="right">{step.rows_in.toLocaleString()}</TableCell>
              <TableCell align="right">{step.rows_out.toLocaleString()}</TableCell>
              <TableCell align="right">{step.rows_dropped.toLocaleString()}</TableCell>
              <TableCell align="right">{formatSec(step.mean_tts_sec)}</TableCell>
              <TableCell align="right">{formatSec(step.median_tts_sec)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
