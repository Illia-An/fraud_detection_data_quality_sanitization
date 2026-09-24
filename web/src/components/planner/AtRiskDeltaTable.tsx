import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  Box,
  Button,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import {
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  type MonitorSignal,
  type PlanMonitoringInsights,
} from '../../schemas/planMonitoring';

export interface StoreBaselineRow {
  store_id: number;
  five_percent: number;
}

export type AtRiskFilter = 'behind' | 'top_gainers' | 'top_losers' | 'all';

interface AtRiskDeltaTableProps {
  plan: FivePercentPlan;
  approvedPlan: FivePercentPlan | null;
  baselineRows: StoreBaselineRow[];
  insights: PlanMonitoringInsights;
  asOfOptions: { year: number; month: number }[];
  onAsOfChange: (year: number, month: number) => void;
  onInspect: (storeId: number) => void;
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

function lastScore(plan: FivePercentPlan, storeId: number): number | null {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection || projection.months.length === 0) {
    return null;
  }
  return projection.months[projection.months.length - 1]?.score ?? null;
}

function statusLabel(signal: MonitorSignal, delta: number | null): string {
  if (signal === 'behind_plan') {
    return 'Behind Plan';
  }
  if (signal === 'ahead_of_plan') {
    return 'Recovered';
  }
  if (delta != null && delta > 0.5) {
    return 'Recovered';
  }
  if (signal === 'insufficient_history') {
    return 'No actual';
  }
  return SIGNAL_LABELS[signal];
}

/** V4.2 Component E — exception-focused store impact table. */
export function AtRiskDeltaTable({
  plan,
  approvedPlan,
  baselineRows,
  insights,
  asOfOptions,
  onAsOfChange,
  onInspect,
}: AtRiskDeltaTableProps) {
  const [filter, setFilter] = useState<AtRiskFilter>('behind');
  const asOfValue = periodLabel(insights.as_of_year, insights.as_of_month);
  const lastPeriod = plan.chain_trajectory[plan.chain_trajectory.length - 1];
  const lastLabel = lastPeriod ? periodLabel(lastPeriod.year, lastPeriod.month) : '—';

  const rows = useMemo(() => {
    const baselineMap = new Map(baselineRows.map((r) => [r.store_id, r.five_percent]));
    const signalByStore = new Map(insights.stores.map((s) => [s.store_id, s]));

    const built = plan.projections.map((projection) => {
      const storeId = projection.store_id;
      const approvedPct =
        (approvedPlan ? lastScore(approvedPlan, storeId) : null) ??
        baselineMap.get(storeId) ??
        null;
      const simulatedPct = lastScore(plan, storeId);
      const delta =
        approvedPct != null && simulatedPct != null ? simulatedPct - approvedPct : null;
      const monitor = signalByStore.get(storeId);
      const signal = monitor?.signal ?? 'insufficient_history';
      return {
        storeId,
        approvedPct,
        simulatedPct,
        delta,
        signal,
        status: statusLabel(signal, delta),
      };
    });

    let filtered = built;
    if (filter === 'behind') {
      filtered = built.filter((r) => r.signal === 'behind_plan');
      filtered = [...filtered].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
    } else if (filter === 'top_gainers') {
      filtered = [...built].sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999)).slice(0, 15);
    } else if (filter === 'top_losers') {
      filtered = [...built].sort((a, b) => (a.delta ?? 999) - (b.delta ?? 999)).slice(0, 15);
    } else {
      filtered = [...built].sort((a, b) => {
        const rank = (s: MonitorSignal) =>
          s === 'behind_plan' ? 0 : s === 'insufficient_history' ? 1 : s === 'on_plan' ? 2 : 3;
        const d = rank(a.signal) - rank(b.signal);
        return d !== 0 ? d : (a.delta ?? 0) - (b.delta ?? 0);
      });
    }
    return filtered;
  }, [plan, approvedPlan, baselineRows, insights, filter]);

  return (
    <Stack spacing={1} sx={{ flex: 1, minHeight: 0, height: '100%' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{ flexShrink: 0 }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filter}
          onChange={(_, value: AtRiskFilter | null) => {
            if (value) {
              setFilter(value);
            }
          }}
        >
          <ToggleButton value="behind">At risk (behind)</ToggleButton>
          <ToggleButton value="top_gainers">Top gainers</ToggleButton>
          <ToggleButton value="top_losers">Top losers</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="atrisk-as-of">Status as of</InputLabel>
          <Select
            labelId="atrisk-as-of"
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
            label={`Ahead ${insights.summary.ahead}`}
            sx={{ bgcolor: SIGNAL_COLORS.ahead_of_plan, color: '#fff' }}
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
                Approved %
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Simulated % ({lastLabel})
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Δ pp
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No stores match this filter.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.storeId} hover>
                  <TableCell>{row.storeId}</TableCell>
                  <TableCell align="right">{formatPct(row.approvedPct)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatPct(row.simulatedPct)}
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
                    <Chip
                      size="small"
                      label={formatDelta(row.delta)}
                      color={
                        row.delta == null ? 'default' : row.delta >= 0 ? 'success' : 'error'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      sx={{
                        bgcolor: SIGNAL_COLORS[row.signal],
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => onInspect(row.storeId)}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        Approved = accepted plan end score when present, else cleansed reference. Simulated = draft
        horizon end. Click Inspect for store audit drawer.
      </Typography>
    </Stack>
  );
}
