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
import {
  baselineScore,
  behindStreakMonths,
  gapShareOfBehind,
  momTrendPp,
  panelVolume,
  planEndScore,
  type StoreBaselineRow,
} from './atRiskRowMetrics';

export type { StoreBaselineRow };

/** Exception filters — Behind Plan Only | Top Gainers | All Stores. */
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
  return `${value.toFixed(1)}%`;
}

function formatGapPp(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)} pp`;
}

function formatShare(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(0)}%`;
}

function formatVolume(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString();
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

const COL_COUNT = 12;

/**
 * Management-by-Exception table:
 * Store · Volume · Fact · Plan · Gap · MoM · Baseline→End · Streak · Gap share · Lift · Deficit · Inspect.
 */
export function AtRiskDeltaTable({
  plan,
  baselineRows,
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
    const totalBehindAbsGap = insights.stores
      .filter((s) => s.signal === 'behind_plan' && s.deviation != null && s.deviation < 0)
      .reduce((sum, s) => sum + Math.abs(s.deviation!), 0);

    const built = plan.projections.map((projection) => {
      const storeId = projection.store_id;
      const monitor = insights.stores.find((s) => s.store_id === storeId);
      const signal = monitor?.signal ?? 'insufficient_history';
      const actual = monitor?.actual ?? null;
      const targetAtAsOf = monitor?.planned ?? null;
      const gapPp = monitor?.deviation ?? null;
      const baseline = baselineScore(baselineRows, storeId);
      const endScore = planEndScore(plan, storeId);
      const liftToEnd =
        actual != null && endScore != null
          ? Math.round((endScore - actual) * 100) / 100
          : null;
      return {
        storeId,
        volume: panelVolume(panel, storeId, insights.as_of_year, insights.as_of_month),
        actual,
        targetAtAsOf,
        gapPp,
        momPp: momTrendPp(panel, storeId, insights.as_of_year, insights.as_of_month),
        baseline,
        endScore,
        streak: behindStreakMonths(
          plan,
          panel,
          storeId,
          insights.as_of_year,
          insights.as_of_month,
          insights.band_pp,
        ),
        gapShare: gapShareOfBehind(gapPp, totalBehindAbsGap),
        liftToEnd,
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
  }, [plan, insights, filter, panel, baselineRows]);

  const filterLabelCount =
    filter === 'behind'
      ? insights.summary.behind
      : filter === 'top_gainers'
        ? Math.min(15, plan.projections.length)
        : plan.projections.length;

  const cellSx = {
    py: 0.4,
    px: 0.75,
    fontSize: '0.75rem',
    lineHeight: 1.25,
  } as const;
  const headSx = {
    ...cellSx,
    fontWeight: 700,
    bgcolor: 'grey.50',
    fontSize: '0.65rem',
    whiteSpace: 'nowrap',
  } as const;

  return (
    <Stack
      spacing={0.75}
      sx={{ flex: 1, minHeight: 0, height: '100%' }}
      data-testid="atrisk-exception-table"
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ flexShrink: 0 }}
      >
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            size="small"
            label={t('planner.atRisk.behindChip', { count: insights.summary.behind })}
            sx={{
              bgcolor: SIGNAL_COLORS.behind_plan,
              color: '#fff',
              height: 22,
              fontSize: '0.7rem',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            size="small"
            label={t('planner.atRisk.aheadChip', { count: insights.summary.ahead })}
            sx={{
              bgcolor: SIGNAL_COLORS.ahead_of_plan,
              color: '#fff',
              height: 22,
              fontSize: '0.7rem',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="atrisk-filter" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.filter')}
            </InputLabel>
            <Select
              labelId="atrisk-filter"
              label={t('planner.atRisk.filter')}
              value={filter}
              onChange={(event) => setFilter(event.target.value as AtRiskFilter)}
              sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.75 } }}
            >
              <MenuItem value="behind" sx={{ fontSize: '0.75rem' }}>
                {t('planner.atRisk.behindOnly')} ({insights.summary.behind})
              </MenuItem>
              <MenuItem value="top_gainers" sx={{ fontSize: '0.75rem' }}>
                {t('planner.atRisk.topGainers')}
              </MenuItem>
              <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>
                {t('planner.atRisk.all')} ({filterLabelCount})
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="atrisk-as-of" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.asOf')}
            </InputLabel>
            <Select
              labelId="atrisk-as-of"
              label={t('planner.atRisk.asOf')}
              value={asOfValue}
              onChange={(event) => {
                const [y, m] = event.target.value.split('-').map(Number);
                onAsOfChange(y, m);
              }}
              sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.75 } }}
            >
              {asOfOptions.map((opt) => (
                <MenuItem
                  key={periodLabel(opt.year, opt.month)}
                  value={periodLabel(opt.year, opt.month)}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {periodLabel(opt.year, opt.month)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
          bgcolor: 'background.paper',
        }}
      >
        <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': cellSx }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>{t('planner.atRisk.col.store')}</TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.volume')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.actual')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.target')}
              </TableCell>
              <TableCell sx={headSx}>{t('planner.atRisk.col.gap')}</TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.mom')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.baselineEnd')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.streak')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.gapShare')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.lift')}
              </TableCell>
              <TableCell sx={{ ...headSx, minWidth: 88 }}>
                {t('planner.atRisk.col.deficit')}
              </TableCell>
              <TableCell align="right" sx={headSx}>
                {t('planner.atRisk.col.action')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_COUNT}>
                  <Typography variant="caption" color="text.secondary">
                    {t('planner.atRisk.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const deficit = deficitProgress01(row.gapPp);
                const negativeGap = row.gapPp != null && row.gapPp < 0;
                const momNeg = row.momPp != null && row.momPp < 0;
                return (
                  <TableRow
                    key={row.storeId}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => onInspect(row.storeId)}
                  >
                    <TableCell>
                      <Stack spacing={0.15}>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}
                        >
                          {t('planner.atRisk.storeId', { id: row.storeId })}
                        </Typography>
                        <Chip
                          size="small"
                          label={row.status}
                          sx={{
                            bgcolor: SIGNAL_COLORS[row.signal],
                            color: '#fff',
                            height: 16,
                            fontSize: '0.65rem',
                            alignSelf: 'flex-start',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatVolume(row.volume)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatPct(row.actual)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatPct(row.targetAtAsOf)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={formatGapPp(row.gapPp)}
                        sx={{
                          height: 18,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.6 },
                          ...(negativeGap
                            ? { bgcolor: 'error.light', color: 'error.dark' }
                            : row.gapPp != null && row.gapPp > 0
                              ? { bgcolor: 'success.light', color: 'success.dark' }
                              : {}),
                        }}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color: momNeg ? 'warning.main' : undefined,
                        fontWeight: momNeg ? 600 : undefined,
                      }}
                    >
                      {formatGapPp(row.momPp)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.baseline == null && row.endScore == null
                        ? '—'
                        : `${formatPct(row.baseline)} → ${formatPct(row.endScore)}`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.streak > 0 ? row.streak : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatShare(row.gapShare)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.liftToEnd == null ? '—' : formatGapPp(row.liftToEnd)}
                    </TableCell>
                    <TableCell sx={{ minWidth: 72 }}>
                      <LinearProgress
                        variant="determinate"
                        value={deficit * 100}
                        color="error"
                        aria-label={
                          deficit > 0
                            ? `Deficit ${Math.abs(row.gapPp ?? 0).toFixed(1)} pp`
                            : 'No deficit'
                        }
                        sx={{
                          height: 4,
                          borderRadius: 1,
                          bgcolor: 'grey.100',
                          '& .MuiLinearProgress-bar': { borderRadius: 1 },
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="text"
                        color="primary"
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                        onClick={() => onInspect(row.storeId)}
                        sx={{
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: '0.7rem',
                          py: 0.25,
                          minHeight: 0,
                          lineHeight: 1.2,
                        }}
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
        sx={{ flexShrink: 0, pointerEvents: 'none', fontSize: '0.65rem', lineHeight: 1.2 }}
      >
        {t('planner.atRisk.footer', { asOf: asOfValue })}
      </Typography>
    </Stack>
  );
}
