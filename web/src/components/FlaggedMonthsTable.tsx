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
  TableSortLabel,
} from '@mui/material';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

import type { StoreMonthCell } from '../schemas/api';

const columnHelper = createColumnHelper<StoreMonthCell>();

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatZ(value: number): string {
  return value.toFixed(2);
}

const columns = [
  columnHelper.accessor('store_id', { header: 'Store', enableSorting: false }),
  columnHelper.accessor('year', { header: 'Year', enableSorting: false }),
  columnHelper.accessor('month', { header: 'Month', enableSorting: false }),
  columnHelper.accessor('volume', { header: 'Volume' }),
  columnHelper.accessor('five_pct', {
    header: '5%',
    cell: (info) => formatPct(info.getValue()),
  }),
  columnHelper.accessor('z', {
    header: 'z',
    cell: (info) => formatZ(info.getValue()),
  }),
  columnHelper.accessor('flagged', {
    header: 'Flagged',
    enableSorting: false,
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
];

interface FlaggedMonthsTableProps {
  rows: StoreMonthCell[];
}

export function FlaggedMonthsTable({ rows }: FlaggedMonthsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const flaggedRows = useMemo(() => rows.filter((row) => row.flagged), [rows]);

  const table = useReactTable({
    data: flaggedRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (flaggedRows.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Flagged store×months"
        subheader="Tier 2 cells above z and 5% thresholds"
      />
      <CardContent sx={{ pt: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    return (
                      <TableCell key={header.id} sortDirection={header.column.getIsSorted() || false}>
                        {header.isPlaceholder ? null : canSort ? (
                          <TableSortLabel
                            active={header.column.getIsSorted() !== false}
                            direction={header.column.getIsSorted() === 'desc' ? 'desc' : 'asc'}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </TableSortLabel>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableCell>
                    );
                  })}
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
