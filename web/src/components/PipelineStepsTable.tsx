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

const columnHelper = createColumnHelper<StepMetrics>();

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(2)}%`;
}

const columns = [
  columnHelper.accessor('step_name', { header: 'Step' }),
  columnHelper.accessor('rows_in', { header: 'Rows in' }),
  columnHelper.accessor('rows_out', { header: 'Rows out' }),
  columnHelper.accessor('rows_dropped', { header: 'Dropped' }),
  columnHelper.accessor('top_box_rate_pct', {
    header: 'Top-box %',
    cell: (info) => formatPct(info.getValue()),
  }),
];

interface PipelineStepsTableProps {
  steps: StepMetrics[];
}

export function PipelineStepsTable({ steps }: PipelineStepsTableProps) {
  const data = useMemo(() => steps, [steps]);

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
      <CardHeader title="Pipeline steps" subheader="Row counts and 5% KPI after each stage" />
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
