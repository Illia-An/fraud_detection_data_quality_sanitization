import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
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

import { useT } from '../../i18n';
import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import {
  SIGNAL_COLORS,
  type MonitorSignal,
  type PlanMonitoringInsights,
} from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

export interface StoreBaselineRow {
  store_id: number;
  five_percent: number;
}

/** DD exception filters — Behind Plan Only | Top Gainers | All Stores. */
export type AtRiskFilter = 'behind' | 'top_gainers' | 'all';

interface AtRiskDeltaTableProps {
  plan: FivePercentPlan;
  approvedPlan: FivePercentPlan | null;
  baselineRows: StoreBaselineRow[];
  panel: SanitizedPanel;
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

function formatGapPp(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pp`;
}

function volumeAtAsOf(
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.survey_volume ?? null;
}

function statusLabel(signal: MonitorSignal): string {
  if (signal === 'behind_plan') {
    return 'Behind Plan';
  }
  if (signal === 'ahead_of_plan') {
    return 'Ahead';
  }
  if (signal === 'insufficient_history') {
    return 'No actual';
  }
  return 'On plan';
}

/** Deficit strip scale — |gap| capped at 10 pp → 100%. */
function deficitProgress01(gapPp: number | null): number {
  if (gapPp == null || gapPp >= 0) {
    return 0;
  }
  return Math.min(1, Math.abs(gapPp) / 10);
}

/**
 * Datadog SLO Group Table pattern — Management by Exception.
 * Columns: Store · Actual as-of · Target as-of · Gap · Volume · Inspect.
 */
export function AtRiskDeltaTable({
  plan,
  panel,
  insights,
  asOfOptions,
  onAsOfChange,
  onInspect,
}: AtRiskDeltaTableProps) {
  const t = useT();
  const [filter, setFilter] = useState<AtRiskFilter>('behind');
  const asOfValue = periodLabel(insights.as_of_year, insights.as_of_month);

  const rows = useMemo(() => {
    const built = plan.projections.map((projection) => {
      const storeId = projection.store_id;
      const monitor = insights.stores.find((s) => s.store_id === storeId);
      const signal = monitor?.signal ?? 'insufficient_history';
      const actual = monitor?.actual ?? null;
      const targetAtAsOf = monitor?.planned ?? null;
      const gapPp = monitor?.deviation ?? null;
      const volume = volumeAtAsOf(
        panel,
        storeId,
        insights.as_of_year,
        insights.as_of_month,
      );
      return {
        storeId,
        actual,
        targetAtAsOf,
        gapPp,
        volume,
        signal,
        status: statusLabel(signal),
      };
    });

    if (filter === 'behind') {
      return built
        .filter((r) => r.signal === 'behind_plan')
        .sort((a, b) => (a.gapPp ?? 0) - (b.gapPp ?? 0));
    }
    if (filter === 'top_gainers') {
      return [...built]
        .sort((a, b) => (b.gapPp ?? -999) - (a.gapPp ?? -999))
        .slice(0, 15);
    }
    return [...built].sort((a, b) => {
      const rank = (s: MonitorSignal) =>
        s === 'behind_plan' ? 0 : s === 'insufficient_history' ? 1 : s === 'on_plan' ? 2 : 3;
      const d = rank(a.signal) - rank(b.signal);
      return d !== 0 ? d : (a.gapPp ?? 0) - (b.gapPp ?? 0);
    });
  }, [plan, panel, insights, filter]);

  return (
    <Stack spacing={1} sx={{ flex: 1, minHeight: 0, height: '100%' }} data-testid="atrisk-exception-table">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{
          flexShrink: 0,
          flexWrap: 'wrap',
          overflowX: 'auto',
          pb: 0.25,
          '&::-webkit-scrollbar': { height: 6 },
        }}
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
          <ToggleButton value="behind">{t('planner.atRisk.behindOnly')}</ToggleButton>
          <ToggleButton value="top_gainers">{t('planner.atRisk.topGainers')}</ToggleButton>
          <ToggleButton value="all">{t('planner.atRisk.all')}</ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="atrisk-as-of">{t('planner.atRisk.asOf')}</InputLabel>
          <Select
            labelId="atrisk-as-of"
            label={t('planner.atRisk.asOf')}
            value={asOfValue}
            onChange={(event) => {
              const [y, m] = event.target.value.split('-').map(Number);
              onAsOfChange(y, m);
            }}
          >
            {asOfOptions.map((opt) => (
              <MenuItem
                key={periodLabel(opt.year, opt.month)}
                value={periodLabel(opt.year, opt.month)}
              >
                {periodLabel(opt.year, opt.month)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={t('planner.atRisk.behindChip', { count: insights.summary.behind })}
            sx={{ bgcolor: SIGNAL_COLORS.behind_plan, color: '#fff' }}
          />
          <Chip
            size="small"
            label={t('planner.atRisk.aheadChip', { count: insights.summary.ahead })}
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
              <TableCell sx={{ fontWeight: 700 }}>{t('planner.atRisk.col.store')}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {t('planner.atRisk.col.actual')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {t('planner.atRisk.col.target')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>
                {t('planner.atRisk.col.gap')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {t('planner.atRisk.col.volume')}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {t('planner.atRisk.col.action')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('planner.atRisk.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const deficit = deficitProgress01(row.gapPp);
                return (
                  <TableRow
                    key={row.storeId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onInspect(row.storeId)}
                  >
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" fontWeight={600}>
                          {row.storeId}
                        </Typography>
                        <Chip
                          size="small"
                          label={row.status}
                          sx={{
                            bgcolor: SIGNAL_COLORS[row.signal],
                            color: '#fff',
                            height: 20,
                            alignSelf: 'flex-start',
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{formatPct(row.actual)}</TableCell>
                    <TableCell align="right">{formatPct(row.targetAtAsOf)}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Chip
                          size="small"
                          label={formatGapPp(row.gapPp)}
                          color={
                            row.gapPp == null
                              ? 'default'
                              : row.gapPp >= 0
                                ? 'success'
                                : 'error'
                          }
                          variant="outlined"
                          sx={{ alignSelf: 'flex-start' }}
                        />
                        {deficit > 0 && (
                          <LinearProgress
                            variant="determinate"
                            value={deficit * 100}
                            color="error"
                            aria-label={`Deficit ${Math.abs(row.gapPp ?? 0).toFixed(1)} pp`}
                            sx={{ height: 4, borderRadius: 1, maxWidth: 120 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {row.volume == null ? '—' : row.volume.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => onInspect(row.storeId)}
                      >
                        {t('planner.atRisk.inspect')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ flexShrink: 0, pointerEvents: 'none' }}
      >
        Management by exception · Gap = actual − plan at as-of ({asOfValue}). Behind ranked by
        worst negative gap. Row or Inspect opens the session sandbox drawer.
      </Typography>
    </Stack>
  );
}
