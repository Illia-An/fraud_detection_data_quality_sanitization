import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import type { ChainMonthCompare } from '../schemas/planMonitoring';
import { periodLabel } from '../schemas/plan';

interface ChainPlanDashboardProps {
  months: ChainMonthCompare[];
  referenceLabel: string;
  /** Chain target % — shown as a constant row (v4.1 “Target Cap”). */
  target: number;
}

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(1);
}

function formatDelta(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

export function ChainPlanDashboard({
  months,
  referenceLabel,
  target,
}: ChainPlanDashboardProps) {
  if (months.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Waiting for plan months…
      </Typography>
    );
  }

  const last = months[months.length - 1];
  const gapToTarget = last.estimate - target;
  const monthsWithActual = months.filter((m) => m.actual != null).length;

  return (
    <Stack spacing={1} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Series</TableCell>
              {months.map((month) => (
                <TableCell key={periodLabel(month.year, month.month)} align="center">
                  {periodLabel(month.year, month.month)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Plan estimate</TableCell>
              {months.map((month) => (
                <TableCell
                  key={`e-${periodLabel(month.year, month.month)}`}
                  align="center"
                  sx={{ fontWeight: 600 }}
                >
                  {formatPct(month.estimate)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>
                Target
              </TableCell>
              {months.map((month) => (
                <TableCell
                  key={`t-${periodLabel(month.year, month.month)}`}
                  align="center"
                  sx={{ color: 'primary.main' }}
                >
                  {target.toFixed(1)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Cleansed actual</TableCell>
              {months.map((month) => (
                <TableCell key={`a-${periodLabel(month.year, month.month)}`} align="center">
                  {formatPct(month.actual)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Δ actual − plan</TableCell>
              {months.map((month) => (
                <TableCell
                  key={`d-${periodLabel(month.year, month.month)}`}
                  align="center"
                  sx={{
                    color:
                      month.delta == null
                        ? undefined
                        : month.delta >= 0
                          ? 'success.main'
                          : 'error.main',
                  }}
                >
                  {formatDelta(month.delta)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ flexShrink: 0 }}>
        5% Score · ref {referenceLabel}. Last plan month estimate{' '}
        <strong>{formatPct(last.estimate)}%</strong> vs target{' '}
        <strong>{target.toFixed(1)}%</strong>
        {' · '}
        {gapToTarget >= -1e-9
          ? `at/above target (${gapToTarget >= 0 ? '+' : ''}${gapToTarget.toFixed(1)} pp)`
          : `short of target (${gapToTarget.toFixed(1)} pp)`}
        . Actuals filled for {monthsWithActual}/{months.length} plan months (future months stay
        empty until the cleansed panel covers them).
      </Typography>
    </Stack>
  );
}
