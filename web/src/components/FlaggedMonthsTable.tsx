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
  Typography,
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

function buildColumns(maxVolume: number, compact: boolean) {
  return [
    columnHelper.accessor('store_id', { header: 'Store', enableSorting: false }),
    columnHelper.accessor('year', {
      header: 'Year',
      enableSorting: false,
      meta: { hideInCompact: true },
    }),
    columnHelper.accessor('month', {
      header: 'Mo',
      enableSorting: false,
    }),
    columnHelper.accessor('volume', {
      header: compact ? 'Vol' : 'Volume',
      cell: (info) => {
        const volume = info.getValue();
        if (compact) {
          return (
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {volume}
            </Box>
          );
        }
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
      header: compact ? 'Flag' : 'Flagged',
      enableSorting: false,
      cell: (info) => (info.getValue() ? 'Yes' : 'No'),
      meta: { hideInCompact: true },
    }),
  ].filter((column) => {
    if (!compact) {
      return true;
    }
    const meta = column.meta as { hideInCompact?: boolean } | undefined;
    return !meta?.hideInCompact;
  });
}

interface FlaggedMonthsTableProps {
  rows: StoreMonthCell[];
  /** Panel beside the store chart (always visible; denser columns + scroll). */
  variant?: 'default' | 'panel';
}

export function FlaggedMonthsTable({ rows, variant = 'default' }: FlaggedMonthsTableProps) {
  const isPanel = variant === 'panel';
  const [sorting, setSorting] = useState<SortingState>([{ id: 'z', desc: true }]);
  const selectFlaggedStoreMonth = useUiStore((state) => state.selectFlaggedStoreMonth);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);

  const flaggedRows = useMemo(() => rows.filter((row) => row.flagged), [rows]);
  const maxVolume = useMemo(
    () => flaggedRows.reduce((max, row) => Math.max(max, row.volume), 0),
    [flaggedRows],
  );
  const columns = useMemo(() => buildColumns(maxVolume, isPanel), [maxVolume, isPanel]);

  const table = useReactTable({
    data: flaggedRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!isPanel && flaggedRows.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title="Flagged store×months"
        subheader={
          isPanel
            ? 'Click a row to focus the chart'
            : 'Tier 4 store×month cells — click a row to focus the store chart'
        }
        titleTypographyProps={{ variant: isPanel ? 'subtitle1' : 'h6' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {flaggedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No flagged store×months for this run.
          </Typography>
        ) : (
          <TableContainer
            sx={{
              flex: 1,
              maxHeight: isPanel ? 540 : undefined,
              overflow: 'auto',
            }}
          >
            <Table size="small" stickyHeader={isPanel}>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <TableCell
                          key={header.id}
                          sortDirection={header.column.getIsSorted() || false}
                          sx={{ py: isPanel ? 0.75 : undefined }}
                        >
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
                        <TableCell key={tableCell.id} sx={{ py: isPanel ? 0.75 : undefined }}>
                          {flexRender(tableCell.column.columnDef.cell, tableCell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
