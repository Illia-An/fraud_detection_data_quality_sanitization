import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  FormControl,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Box,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

import { useT, type MessageKey, type TranslateParams } from '../i18n';
import type { StoreMonthCell } from '../schemas/api';
import { useUiStore } from '../store/uiStore';
import { storeMonthPeriodLabel } from './charts/storeImpactChartData';
import {
  applyFlaggedFilter,
  applyStoreSearch,
  countHighVolume,
  countHighZ,
  medianVolume,
  type FlaggedFilter,
} from './flaggedMonthsFilters';

const columnHelper = createColumnHelper<StoreMonthCell>();

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatZ(value: number): string {
  return value.toFixed(2);
}

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

function buildColumns(maxVolume: number, compact: boolean, t: TranslateFn) {
  return [
    columnHelper.accessor('store_id', { header: t('flagged.col.store'), enableSorting: false }),
    columnHelper.accessor('year', {
      header: t('flagged.col.year'),
      enableSorting: false,
      meta: { hideInCompact: true },
    }),
    columnHelper.accessor('month', {
      header: t('flagged.col.mo'),
      enableSorting: false,
    }),
    columnHelper.accessor('volume', {
      header: compact ? t('flagged.col.vol') : t('flagged.col.volume'),
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
      header: t('flagged.col.five'),
      cell: (info) => formatPct(info.getValue()),
    }),
    columnHelper.accessor('z', {
      header: t('flagged.col.z'),
      sortingFn: (rowA, rowB, columnId) =>
        Math.abs(rowA.getValue<number>(columnId)) - Math.abs(rowB.getValue<number>(columnId)),
      cell: (info) => formatZ(info.getValue()),
    }),
    columnHelper.accessor('flagged', {
      header: compact ? t('flagged.col.flag') : t('flagged.col.flagged'),
      enableSorting: false,
      cell: (info) => (info.getValue() ? t('common.yes') : t('common.no')),
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
  const t = useT();
  const isPanel = variant === 'panel';
  const [sorting, setSorting] = useState<SortingState>([{ id: 'z', desc: true }]);
  const [filter, setFilter] = useState<FlaggedFilter>('all');
  const [storeQuery, setStoreQuery] = useState('');
  const selectFlaggedStoreMonth = useUiStore((state) => state.selectFlaggedStoreMonth);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const highlightedPeriodLabel = useUiStore((state) => state.highlightedPeriodLabel);

  const flaggedRows = useMemo(() => rows.filter((row) => row.flagged), [rows]);
  const volumeFloor = useMemo(() => medianVolume(flaggedRows), [flaggedRows]);
  const highZCount = useMemo(() => countHighZ(flaggedRows), [flaggedRows]);
  const highVolumeCount = useMemo(
    () => countHighVolume(flaggedRows, volumeFloor),
    [flaggedRows, volumeFloor],
  );

  const visibleRows = useMemo(() => {
    const filtered = applyFlaggedFilter(flaggedRows, filter, volumeFloor);
    return applyStoreSearch(filtered, storeQuery);
  }, [flaggedRows, filter, volumeFloor, storeQuery]);

  const maxVolume = useMemo(
    () => visibleRows.reduce((max, row) => Math.max(max, row.volume), 0),
    [visibleRows],
  );
  const columns = useMemo(() => buildColumns(maxVolume, isPanel, t), [maxVolume, isPanel, t]);

  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!isPanel && flaggedRows.length === 0) {
    return null;
  }

  const chipRing = (active: boolean, color: string) =>
    active
      ? (theme: { palette: { common: { white: string } } }) =>
          `0 0 0 2px ${theme.palette.common.white}, 0 0 0 4px ${color}`
      : 'none';

  const filterChips = (
    <>
      <Chip
        size="small"
        clickable
        data-testid="flagged-chip-high-z"
        aria-pressed={filter === 'high_z'}
        aria-label={t('flagged.chip.highZ', { count: highZCount })}
        label={t('flagged.chip.highZ', { count: highZCount })}
        onClick={() => setFilter('high_z')}
        sx={{
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          height: 22,
          fontSize: '0.7rem',
          boxShadow: chipRing(filter === 'high_z', '#ed6c02'),
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
      <Chip
        size="small"
        clickable
        data-testid="flagged-chip-high-volume"
        aria-pressed={filter === 'high_volume'}
        aria-label={t('flagged.chip.highVolume', { count: highVolumeCount })}
        label={t('flagged.chip.highVolume', { count: highVolumeCount })}
        onClick={() => setFilter('high_volume')}
        sx={{
          bgcolor: 'info.main',
          color: 'info.contrastText',
          height: 22,
          fontSize: '0.7rem',
          boxShadow: chipRing(filter === 'high_volume', '#0288d1'),
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </>
  );

  const viewSelect = (
    <FormControl size="small" sx={{ minWidth: isPanel ? 120 : { xs: '100%', sm: 140 }, flex: isPanel ? '0 1 auto' : 1 }}>
      {!isPanel ? (
        <Typography
          component="label"
          htmlFor="flagged-filter-select"
          variant="caption"
          color="text.secondary"
          sx={{ mb: 0.25, display: 'block', lineHeight: 1.2 }}
        >
          {t('flagged.filter')}
        </Typography>
      ) : null}
      <Select
        id="flagged-filter-select"
        value={filter}
        onChange={(event) => setFilter(event.target.value as FlaggedFilter)}
        displayEmpty
        inputProps={{ 'aria-label': t('flagged.filter') }}
        sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.75 } }}
      >
        <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>
          {t('flagged.filter.all')} ({flaggedRows.length})
        </MenuItem>
        <MenuItem value="high_z" sx={{ fontSize: '0.75rem' }}>
          {t('flagged.filter.highZ')} ({highZCount})
        </MenuItem>
        <MenuItem value="high_volume" sx={{ fontSize: '0.75rem' }}>
          {t('flagged.filter.highVolume')} ({highVolumeCount})
        </MenuItem>
      </Select>
    </FormControl>
  );

  const storeSearch = (
    <TextField
      size="small"
      value={storeQuery}
      onChange={(event) => setStoreQuery(event.target.value)}
      placeholder={t('flagged.searchStore')}
      inputProps={{
        'aria-label': t('flagged.searchStore'),
        'data-testid': 'flagged-store-search',
      }}
      sx={{ flex: 1, minWidth: isPanel ? 100 : { xs: '100%', sm: 120 } }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        ),
        sx: { fontSize: '0.75rem' },
      }}
    />
  );

  const tableBody =
    visibleRows.length === 0 ? (
      <Typography variant="body2" color="text.secondary" data-testid="flagged-filter-empty">
        {t('flagged.filterEmpty')}
      </Typography>
    ) : (
      <TableContainer
        sx={{
          flex: 1,
          minHeight: 0,
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
                      sx={{ py: isPanel ? 0.5 : undefined }}
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
                    <TableCell key={tableCell.id} sx={{ py: isPanel ? 0.5 : undefined }}>
                      {flexRender(tableCell.column.columnDef.cell, tableCell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );

  /** Inspect accordion already owns the title — denser toolbar, more room for rows. */
  if (isPanel) {
    return (
      <Box
        data-testid="flagged-months-panel"
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {flaggedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('flagged.empty')}
          </Typography>
        ) : (
          <Stack spacing={0.75} sx={{ flex: 1, minHeight: 0 }}>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              data-testid="flagged-panel-toolbar"
            >
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                data-testid="flagged-filter-chips"
              >
                {filterChips}
              </Stack>
              {viewSelect}
              {storeSearch}
            </Stack>
            {tableBody}
          </Stack>
        )}
      </Box>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={t('flagged.title')}
        subheader={t('flagged.subheaderDefault')}
        titleTypographyProps={{ variant: 'h6' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {flaggedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('flagged.empty')}
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              data-testid="flagged-filter-chips"
            >
              {filterChips}
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={0.75}
              alignItems={{ sm: 'flex-end' }}
            >
              {viewSelect}
              {storeSearch}
            </Stack>
            {tableBody}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
