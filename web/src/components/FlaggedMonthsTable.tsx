import {
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Box,
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
import { useUiStore } from '../store/uiStore';
import { storeMonthPeriodLabel } from './charts/storeImpactChartData';

const columnHelper = createColumnHelper<StoreMonthCell>();

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatZ(value: number): string {
  return value.toFixed(2);
}

function buildColumns(maxVolume: number) {
  return [
    columnHelper.accessor('store_id', { header: 'Store', enableSorting: false }),
    columnHelper.accessor('year', { header: 'Year', enableSorting: false }),
    columnHelper.accessor('month', { header: 'Month', enableSorting: false }),
    columnHelper.accessor('volume', {
      header: 'Volume',
      cell: (info) => {
        const volume = info.getValue();
        const ratio = maxVolume > 0 ? volume / maxVolume : 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 96 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.max(4, ratio * 100)}
                aria-label={`volume ${volume}`}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
              {volume}
            </Box>
          </Box>
        );
      },
    }),
    columnHelper.accessor('five_pct', {
      header: '5%',
      cell: (info) => formatPct(info.getValue()),
    }),
    columnHelper.accessor('z', {
      header: 'z',
      sortingFn: (rowA, rowB, columnId) =>
        Math.abs(rowA.getValue<number>(columnId)) - Math.abs(rowB.getValue<number>(columnId)),
      cell: (info) => formatZ(info.getValue()),
    }),
    columnHelper.accessor('flagged', {
      header: 'Flagged',
      enableSorting: false,
      cell: (info) => (info.getValue() ? 'Yes' : 'No'),
    }),
  ];
}

interface FlaggedMonthsTableProps {
  rows: StoreMonthCell[];
}

export function FlaggedMonthsTable({ rows }: FlaggedMonthsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'z', desc: true }]);
  const selectFlaggedStoreMonth = useUiStore((state) => state.selectFlaggedStoreMonth);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);

  const flaggedRows = useMemo(() => rows.filter((row) => row.flagged), [rows]);
  const maxVolume = useMemo(
    () => flaggedRows.reduce((max, row) => Math.max(max, row.volume), 0),
    [flaggedRows],
  );
  const columns = useMemo(() => buildColumns(maxVolume), [maxVolume]);

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
        subheader="Tier 4 store×month cells — click a row to focus the store chart"
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
              {table.getRowModel().rows.map((row) => {
                const cell = row.original;
                const period = storeMonthPeriodLabel(cell.year, cell.month);
                const selected =
                  selectedStoreId === cell.store_id && highlightedPeriodLabel === period;
                return (
                  <TableRow
                    key={row.id}
                    hover
                    selected={selected}
                    onClick={() => selectFlaggedStoreMonth(cell.store_id, cell.year, cell.month)}
                    sx={{ cursor: 'pointer' }}
                    aria-selected={selected}
                  >
                    {row.getVisibleCells().map((tableCell) => (
                      <TableCell key={tableCell.id}>
                        {flexRender(tableCell.column.columnDef.cell, tableCell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
