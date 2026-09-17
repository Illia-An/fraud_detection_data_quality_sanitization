import {
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import type { StepMetrics } from '../schemas/api';
import { formatPipelineStepLabel, sortPipelineSteps } from '../schemas/api';

type StepRow = StepMetrics & {
  delta_pp: number | null;
  drop_share: number;
  is_largest_delta: boolean;
};

const columnHelper = createColumnHelper<StepRow>();

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}%`;
}

function formatDeltaPp(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pp`;
}

function buildColumns() {
  return [
    columnHelper.accessor('step_name', {
      header: 'Step',
      cell: (info) => formatPipelineStepLabel(info.getValue()),
    }),
    columnHelper.accessor('rows_in', { header: 'Rows in' }),
    columnHelper.accessor('rows_out', { header: 'Rows out' }),
    columnHelper.accessor('rows_dropped', {
      header: 'Excluded',
      cell: (info) => {
        const row = info.row.original;
        const sharePct = Math.round(row.drop_share * 100);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
            <Box sx={{ flex: 1, minWidth: 56 }}>
              <LinearProgress
                variant="determinate"
                value={Math.max(row.drop_share > 0 ? 4 : 0, row.drop_share * 100)}
                aria-label={`excluded share ${sharePct}%`}
                color={row.is_largest_delta ? 'warning' : 'primary'}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Typography
              component="span"
              variant="body2"
              sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 28 }}
            >
              {info.getValue()}
            </Typography>
          </Box>
        );
      },
    }),
    columnHelper.accessor('top_box_pct', {
      header: 'Top-box %',
      cell: (info) => formatPct(info.getValue()),
    }),
    columnHelper.accessor('delta_pp', {
      header: 'Δ vs prev',
      cell: (info) => {
        const value = info.getValue();
        const largest = info.row.original.is_largest_delta;
        return (
          <Typography
            component="span"
            variant="body2"
            fontWeight={largest ? 700 : 400}
            color={largest ? 'warning.main' : undefined}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatDeltaPp(value)}
            {largest ? ' ★' : ''}
          </Typography>
        );
      },
    }),
  ];
}

const columns = buildColumns();

export function buildPipelineStepRows(steps: StepMetrics[]): StepRow[] {
  const ordered = sortPipelineSteps(steps);
  const withDelta = ordered.map((step, index) => {
    const prev = index > 0 ? ordered[index - 1] : null;
    const delta_pp =
      prev == null ? null : Number((step.top_box_pct - prev.top_box_pct).toFixed(4));
    const drop_share = step.rows_in > 0 ? step.rows_dropped / step.rows_in : 0;
    return { ...step, delta_pp, drop_share, is_largest_delta: false };
  });

  let maxAbs = -1;
  let maxIndex = -1;
  withDelta.forEach((row, index) => {
    if (row.delta_pp == null) {
      return;
    }
    const abs = Math.abs(row.delta_pp);
    if (abs > maxAbs) {
      maxAbs = abs;
      maxIndex = index;
    }
  });

  if (maxIndex >= 0 && maxAbs > 0) {
    withDelta[maxIndex] = { ...withDelta[maxIndex], is_largest_delta: true };
  }

  return withDelta;
}

export function summarizeLargestDelta(steps: StepMetrics[]): string | null {
  const rows = buildPipelineStepRows(steps);
  const largest = rows.find((row) => row.is_largest_delta);
  if (!largest || largest.delta_pp == null) {
    return null;
  }
  return `${formatPipelineStepLabel(largest.step_name)} (${formatDeltaPp(largest.delta_pp)})`;
}

interface PipelineStepsTableProps {
  steps: StepMetrics[];
}

export function PipelineStepsTable({ steps }: PipelineStepsTableProps) {
  const data = useMemo(() => buildPipelineStepRows(steps), [steps]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (steps.length === 0) {
    return null;
  }

  return (
    <TableContainer>
      <Table size="small" data-testid="pipeline-steps-funnel">
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              selected={row.original.is_largest_delta}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
