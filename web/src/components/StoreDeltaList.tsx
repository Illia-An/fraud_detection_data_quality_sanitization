import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import type { FivePercentPlan } from '../schemas/plan';
import {
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  type PlanMonitoringInsights,
} from '../schemas/planMonitoring';
import { periodLabel } from '../schemas/plan';

export interface StoreBaselineRow {
  store_id: number;
  five_percent: number;
}

interface StoreDeltaListProps {
  plan: FivePercentPlan;
  baselineRows: StoreBaselineRow[];
  insights: PlanMonitoringInsights;
  asOfOptions: { year: number; month: number }[];
  onAsOfChange: (year: number, month: number) => void;
  onStoreClick: (storeId: number) => void;
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

function lastPlanScore(plan: FivePercentPlan, storeId: number): number | null {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection || projection.months.length === 0) {
    return null;
  }
  return projection.months[projection.months.length - 1]?.score ?? null;
}

/** v4.1-style store delta list: Was (ref) → In plan (horizon end) · Δ · signal. */
export function StoreDeltaList({
  plan,
  baselineRows,
  insights,
  asOfOptions,
  onAsOfChange,
  onStoreClick,
}: StoreDeltaListProps) {
  const baselineMap = new Map(baselineRows.map((r) => [r.store_id, r.five_percent]));
  const signalByStore = new Map(insights.stores.map((s) => [s.store_id, s]));
  const asOfValue = periodLabel(insights.as_of_year, insights.as_of_month);

  const rows = plan.projections.map((projection) => {
    const storeId = projection.store_id;
    const was = baselineMap.get(storeId) ?? null;
    const inPlan = lastPlanScore(plan, storeId);
    const delta = was != null && inPlan != null ? inPlan - was : null;
    const monitor = signalByStore.get(storeId);
    return {
      storeId,
      was,
      inPlan,
      delta,
      signal: monitor?.signal ?? 'insufficient_history',
    };
  });

  rows.sort((a, b) => {
    const signalRank = (s: string) =>
      s === 'behind_plan' ? 0 : s === 'insufficient_history' ? 1 : s === 'on_plan' ? 2 : 3;
    const rankDiff = signalRank(a.signal) - signalRank(b.signal);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return (a.delta ?? 0) - (b.delta ?? 0);
  });

  const lastPeriod = plan.chain_trajectory[plan.chain_trajectory.length - 1];
  const lastLabel = lastPeriod
    ? periodLabel(lastPeriod.year, lastPeriod.month)
    : '—';

  return (
    <Stack spacing={1} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{ flexShrink: 0 }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="delta-as-of-label">Status as of</InputLabel>
          <Select
            labelId="delta-as-of-label"
            label="Status as of"
            value={asOfValue}
            onChange={(event) => {
              const [y, m] = event.target.value.split('-').map(Number);
              onAsOfChange(y, m);
            }}
          >
            {asOfOptions.map((opt) => (
              <MenuItem key={periodLabel(opt.year, opt.month)} value={periodLabel(opt.year, opt.month)}>
                {periodLabel(opt.year, opt.month)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`Behind ${insights.summary.behind}`}
            sx={{ bgcolor: SIGNAL_COLORS.behind_plan, color: '#fff' }}
          />
          <Chip
            size="small"
            label={`On plan ${insights.summary.on_plan}`}
            sx={{ bgcolor: SIGNAL_COLORS.on_plan, color: '#fff' }}
          />
          <Chip
            size="small"
            label={`Ahead ${insights.summary.ahead}`}
            sx={{ bgcolor: SIGNAL_COLORS.ahead_of_plan, color: '#fff' }}
          />
          <Chip
            size="small"
            label={`No actual ${insights.summary.insufficient}`}
            sx={{ bgcolor: SIGNAL_COLORS.insufficient_history, color: '#fff' }}
          />
        </Stack>
      </Stack>
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
              <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Was (ref)
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                In plan ({lastLabel})
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Δ pp
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.storeId}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onStoreClick(row.storeId)}
              >
                <TableCell>{row.storeId}</TableCell>
                <TableCell align="right">{formatPct(row.was)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatPct(row.inPlan)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color:
                      row.delta == null
                        ? undefined
                        : row.delta >= 0
                          ? 'success.main'
                          : 'error.main',
                  }}
                >
                  {formatDelta(row.delta)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={SIGNAL_LABELS[row.signal]}
                    sx={{ bgcolor: SIGNAL_COLORS[row.signal], color: '#fff' }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        Was = cleansed score at reference · In plan = estimate at horizon end · Status vs plan as
        of {asOfValue}. Click row → sandbox draft (does not mutate saved plan).
      </Typography>
    </Stack>
  );
}
