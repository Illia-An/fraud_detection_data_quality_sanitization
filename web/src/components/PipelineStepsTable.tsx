import {
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

const columnHelper = createColumnHelper<StepMetrics & { delta_pp: number | null }>();

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

const columns = [
  columnHelper.accessor('step_name', {
    header: 'Step',
    cell: (info) => formatPipelineStepLabel(info.getValue()),
  }),
  columnHelper.accessor('rows_in', { header: 'Rows in' }),
  columnHelper.accessor('rows_out', { header: 'Rows out' }),
  columnHelper.accessor('rows_dropped', { header: 'Excluded' }),
  columnHelper.accessor('top_box_pct', {
    header: 'Top-box %',
    cell: (info) => formatPct(info.getValue()),
  }),
  columnHelper.accessor('delta_pp', {
    header: 'Δ vs prev',
    cell: (info) => formatDeltaPp(info.getValue()),
  }),
];

interface PipelineStepsTableProps {
  steps: StepMetrics[];
}

export function PipelineStepsTable({ steps }: PipelineStepsTableProps) {
  const data = useMemo(() => {
    const ordered = sortPipelineSteps(steps);
    return ordered.map((step, index) => {
      const prev = index > 0 ? ordered[index - 1] : null;
      const delta_pp =
        prev == null ? null : Number((step.top_box_pct - prev.top_box_pct).toFixed(4));
      return { ...step, delta_pp };
    });
  }, [steps]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (steps.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Pipeline steps"
        subheader="Row counts, 5% KPI, and change vs previous stage"
      />
      <CardContent sx={{ pt: 0 }}>
        <TableContainer>
          <Table size="small">
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
                <TableRow key={row.id}>
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
      </CardContent>
    </Card>
  );
}
