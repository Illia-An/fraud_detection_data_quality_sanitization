import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { usePlan } from '../api/hooks';
import { AtRiskDeltaTable } from '../components/planner/AtRiskDeltaTable';
import { HeroSimulationChart } from '../components/planner/HeroSimulationChart';
import { PlannerBaselineBadge } from '../components/planner/PlannerBaselineBadge';
import { PlannerSandboxBar } from '../components/planner/PlannerSandboxBar';
import {
  PLANNER_RUN_BLOCK_TOOLTIPS,
  plannerRunBlockReason,
} from '../components/planner/plannerRunGuards';
import { SimulationSummaryKpis } from '../components/planner/SimulationSummaryKpis';
import { StoreAuditDrawer } from '../components/planner/StoreAuditDrawer';
import {
  buildSanitizedPanelFromProcess,
  type SanitizedPanel,
} from '../schemas/sanitizedPanel';
import {
  DEFAULT_PLAN_PARAMS,
  periodLabel,
  type FivePercentPlan,
  type PlanParams,
} from '../schemas/plan';
import {
  buildPlanMonitoringInsights,
  defaultAsOf,
} from '../schemas/planMonitoring';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';

const RAIL_WIDTH_PX = 320;
const RAIL_COLLAPSED_PX = 40;
/** Delay before showing collapsed Play so the collapse click cannot ghost-hit it. */
const COLLAPSED_PLAY_REVEAL_MS = 250;

function baselineRowsAtReference(
  panel: SanitizedPanel,
  year: number,
  month: number,
): { store_id: number; five_percent: number }[] {
  return panel.rows
    .filter((row) => row.year === year && row.month === month)
    .map((row) => ({ store_id: row.store_id, five_percent: row.five_percent }));
}

function availableReferences(panel: SanitizedPanel): { year: number; month: number }[] {
  const keys = new Set<string>();
  const out: { year: number; month: number }[] = [];
  for (const row of panel.rows) {
    const key = periodLabel(row.year, row.month);
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    out.push({ year: row.year, month: row.month });
  }
  out.sort((a, b) => a.year - b.year || a.month - b.month);
  return out;
}

function meanChain(rows: { five_percent: number }[]): number | null {
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((sum, row) => sum + row.five_percent, 0) / rows.length;
}

function downloadPlanCsv(plan: FivePercentPlan): void {
  const periods = plan.chain_trajectory;
  const header = ['store_id', ...periods.map((p) => periodLabel(p.year, p.month))];
  const lines = [header.join(',')];
  lines.push(
    [
      'chain',
      ...periods.map((p) => {
        const hit = plan.chain_trajectory.find((m) => m.year === p.year && m.month === p.month);
        return hit ? String(hit.score) : '';
      }),
    ].join(','),
  );
  for (const projection of plan.projections) {
    lines.push(
      [
        String(projection.store_id),
        ...periods.map((p) => {
          const hit = projection.months.find((m) => m.year === p.year && m.month === p.month);
          return hit ? String(hit.score) : '';
        }),
      ].join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'plan_five_percent_projections.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PlannerPage() {
  const theme = useTheme();
  const processResult = useUiStore((state) => state.processResult);
  const planMutation = usePlan();

  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);
  const approvedPlan = usePlannerScenarioStore((s) => s.approvedPlan);
  const isDirty = usePlannerScenarioStore((s) => s.isDirty);
  const selectedStoreId = usePlannerScenarioStore((s) => s.selectedStoreId);
  const setDraftFromRun = usePlannerScenarioStore((s) => s.setDraftFromRun);
  const acceptDraftAsApproved = usePlannerScenarioStore((s) => s.acceptDraftAsApproved);
  const discardDraft = usePlannerScenarioStore((s) => s.discardDraft);
  const clearAll = usePlannerScenarioStore((s) => s.clearAll);
  const selectStore = usePlannerScenarioStore((s) => s.selectStore);

  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);

  const panel = useMemo(() => {
    if (!processResult) {
      return null;
    }
    try {
      return buildSanitizedPanelFromProcess(processResult);
    } catch {
      return null;
    }
  }, [processResult]);

  const refs = useMemo(() => (panel ? availableReferences(panel) : []), [panel]);
  const suggested = refs.length ? refs[refs.length - 1] : null;

  const [referenceYear, setReferenceYear] = useState<number | null>(null);
  const [referenceMonth, setReferenceMonth] = useState<number | null>(null);
  const [target, setTarget] = useState(75);
  const [horizon, setHorizon] = useState(6);
  const [params, setParams] = useState<PlanParams>(DEFAULT_PLAN_PARAMS);
  const [asOfYear, setAsOfYear] = useState<number | null>(null);
  const [asOfMonth, setAsOfMonth] = useState<number | null>(null);

  const railWidth = controlsOpen ? RAIL_WIDTH_PX : RAIL_COLLAPSED_PX;

  useEffect(() => {
    if (controlsOpen) {
      setShowCollapsedPlay(false);
      return;
    }
    const timerId = window.setTimeout(() => setShowCollapsedPlay(true), COLLAPSED_PLAY_REVEAL_MS);
    return () => window.clearTimeout(timerId);
  }, [controlsOpen]);

  const effectiveYear = referenceYear ?? suggested?.year ?? null;
  const effectiveMonth = referenceMonth ?? suggested?.month ?? null;

  const baselineRows =
    panel && effectiveYear != null && effectiveMonth != null
      ? baselineRowsAtReference(panel, effectiveYear, effectiveMonth)
      : [];
  const currentChain = meanChain(baselineRows);
  const baselineReady = panel != null && panel.row_count > 0;
  const runBlock = plannerRunBlockReason({
    baselineReady,
    storeCount: baselineRows.length,
    currentChain,
    target,
    horizon,
    maxMonthlyImprove: params.max_monthly_improve,
    isPending: planMutation.isPending,
  });
  const canRun = runBlock == null;
  const runTooltip = runBlock ? PLANNER_RUN_BLOCK_TOOLTIPS[runBlock] : '';

  const directionLabel =
    currentChain == null
      ? '—'
      : target > currentChain + 1e-9
        ? 'Improve ↑'
        : target < currentChain - 1e-9
          ? 'Invalid ↓'
          : 'Hold';

  const monitoring = useMemo(() => {
    if (!draftPlan || !panel) {
      return null;
    }
    const fallback = defaultAsOf(draftPlan, panel);
    const year = asOfYear ?? fallback.year;
    const month = asOfMonth ?? fallback.month;
    return buildPlanMonitoringInsights(draftPlan, panel, { year, month });
  }, [draftPlan, panel, asOfYear, asOfMonth]);

  const handleRun = () => {
    if (!canRun || effectiveYear == null || effectiveMonth == null) {
      return;
    }
    planMutation.mutate(
      {
        reference_year: effectiveYear,
        reference_month: effectiveMonth,
        horizon,
        target,
        params,
        baseline_rows: baselineRows,
      },
      {
        onSuccess: (response) => {
          const next = response.metrics.five_percent;
          setDraftFromRun(next);
          if (panel) {
            const asOf = defaultAsOf(next, panel);
            setAsOfYear(asOf.year);
            setAsOfMonth(asOf.month);
          }
        },
      },
    );
  };

  const handleDiscardDraft = () => {
    discardDraft();
    setAsOfYear(null);
    setAsOfMonth(null);
  };

  const handleAcceptDraft = () => {
    acceptDraftAsApproved();
  };

  const handleExportCsv = () => {
    if (!draftPlan) {
      return;
    }
    downloadPlanCsv(draftPlan);
    acceptDraftAsApproved();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flex: 1,
        minHeight: 0,
        height: { xs: 'auto', md: '100%' },
        overflow: { xs: 'auto', md: 'hidden' },
        gap: { xs: 2, md: 0 },
      }}
    >
      <Box
        component="aside"
        data-testid="controls-rail"
        data-collapsed={controlsOpen ? 'false' : 'true'}
        sx={{
          width: { xs: '100%', md: railWidth },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: { md: 0 },
          overflow: { md: 'hidden' },
          borderRight: { md: 1 },
          borderColor: { md: 'divider' },
          pr: { md: controlsOpen ? 2 : 0.5 },
          mr: { md: controlsOpen ? 2 : 1 },
          transition: theme.transitions.create(['width', 'padding', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            justifyContent: controlsOpen ? 'flex-end' : 'center',
            flexShrink: 0,
            pb: 0.5,
          }}
        >
          <Tooltip title={controlsOpen ? 'Collapse controls' : 'Expand controls'} placement="right">
            <IconButton
              size="small"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label={controlsOpen ? 'Collapse controls' : 'Expand controls'}
              aria-expanded={controlsOpen}
            >
              {controlsOpen ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Keep mounted when collapsed so form state is preserved. */}
        <Box
          sx={{
            display: { xs: 'flex', md: controlsOpen ? 'flex' : 'none' },
            flexDirection: 'column',
            flex: { md: 1 },
            minHeight: { md: 0 },
            overflowY: { xs: 'visible', md: 'auto' },
            overflowX: 'hidden',
            gap: 1.5,
            pb: 1,
          }}
        >
        {!baselineReady && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                component={RouterLink}
                to="/"
                startIcon={<ScienceRoundedIcon />}
              >
                Sanitization
              </Button>
            }
          >
            Run Sanitization first. Plan Run stays disabled until a cleansed baseline exists.
          </Alert>
        )}

        <Card variant="outlined">
          <CardHeader title="5% Score" subheader="Allocation levers" sx={{ pb: 0.5 }} />
          <CardContent sx={{ pt: 1 }}>
            <Stack spacing={1}>
              <PlannerBaselineBadge
                panel={panel}
                processResult={processResult}
                baselineReady={baselineReady}
              />
              <Typography variant="body2">
                Current:{' '}
                <strong>{currentChain == null ? '—' : `${currentChain.toFixed(2)}%`}</strong>
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Direction:</Typography>
                <Chip
                  size="small"
                  label={directionLabel}
                  color={directionLabel.startsWith('Improve') ? 'success' : 'default'}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader title="Data & reference" sx={{ pb: 0.5 }} />
          <CardContent sx={{ pt: 1 }}>
            <FormControl fullWidth size="small" disabled={!baselineReady || refs.length === 0}>
              <InputLabel id="ref-period-label">Reference period</InputLabel>
              <Select
                labelId="ref-period-label"
                label="Reference period"
                value={
                  effectiveYear != null && effectiveMonth != null
                    ? periodLabel(effectiveYear, effectiveMonth)
                    : ''
                }
                onChange={(event) => {
                  const [y, m] = event.target.value.split('-').map(Number);
                  setReferenceYear(y);
                  setReferenceMonth(m);
                  clearAll();
                  setAsOfYear(null);
                  setAsOfMonth(null);
                }}
              >
                {refs.map((ref) => (
                  <MenuItem key={periodLabel(ref.year, ref.month)} value={periodLabel(ref.year, ref.month)}>
                    {periodLabel(ref.year, ref.month)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">
              Stores at reference ({baselineRows.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ maxHeight: 180, overflow: 'auto', pt: 0 }}>
            {baselineRows.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No store scores for this reference month.
              </Typography>
            ) : (
              <Stack spacing={0.25}>
                {baselineRows
                  .slice()
                  .sort((a, b) => a.five_percent - b.five_percent)
                  .map((row) => (
                    <Stack
                      key={row.store_id}
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Typography variant="caption">{row.store_id}</Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {row.five_percent.toFixed(1)}%
                      </Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        <Card variant="outlined">
          <CardHeader title="Planner parameters" sx={{ pb: 0.5 }} />
          <CardContent sx={{ pt: 1 }}>
            <Stack spacing={1.25}>
              <TextField
                label="Target (%)"
                type="number"
                size="small"
                value={target}
                disabled={!baselineReady}
                onChange={(e) => setTarget(Number(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
              <TextField
                label="Months"
                type="number"
                size="small"
                value={horizon}
                disabled={!baselineReady}
                onChange={(e) => setHorizon(Number(e.target.value))}
                inputProps={{ min: 1, max: 60 }}
              />
              <TextField
                label="Max monthly improve"
                type="number"
                size="small"
                value={params.max_monthly_improve}
                disabled={!baselineReady}
                onChange={(e) =>
                  setParams((p) => ({ ...p, max_monthly_improve: Number(e.target.value) }))
                }
                inputProps={{ min: 0.01, step: 0.1 }}
              />

              <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption">Advanced (trajectory / priority)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.25}>
                    <TextField
                      label="Priority power"
                      type="number"
                      size="small"
                      value={params.priority_power}
                      disabled={!baselineReady}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, priority_power: Number(e.target.value) }))
                      }
                      inputProps={{ min: 0.1, step: 0.1 }}
                    />
                    <FormControl fullWidth size="small" disabled={!baselineReady}>
                      <InputLabel id="traj-label">Trajectory</InputLabel>
                      <Select
                        labelId="traj-label"
                        label="Trajectory"
                        value={params.trajectory}
                        onChange={(e) =>
                          setParams((p) => ({
                            ...p,
                            trajectory: e.target.value as PlanParams['trajectory'],
                          }))
                        }
                      >
                        <MenuItem value="uniform">Uniform</MenuItem>
                        <MenuItem value="front_loaded">Front loaded</MenuItem>
                        <MenuItem value="accelerated">Accelerated</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Trajectory power"
                      type="number"
                      size="small"
                      value={params.trajectory_power}
                      disabled={!baselineReady || params.trajectory === 'uniform'}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, trajectory_power: Number(e.target.value) }))
                      }
                      inputProps={{ min: 0.1, step: 0.1 }}
                    />
                    <TextField
                      label="Growth factor"
                      type="number"
                      size="small"
                      value={params.growth_factor}
                      disabled={!baselineReady}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, growth_factor: Number(e.target.value) }))
                      }
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Tooltip title={canRun ? '' : runTooltip}>
                <span>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={
                      planMutation.isPending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <PlayArrowIcon />
                      )
                    }
                    disabled={!canRun}
                    onClick={handleRun}
                  >
                    {planMutation.isPending ? 'Running...' : 'Run simulation'}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={draftPlan ? '' : 'Run a simulation first to enable export.'}>
                <span>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DownloadRoundedIcon />}
                    disabled={!draftPlan}
                    onClick={handleExportCsv}
                  >
                    Export Excel (CSV)
                  </Button>
                </span>
              </Tooltip>
              {runBlock === 'no_stores' && (
                <Typography variant="caption" color="warning.main">
                  {PLANNER_RUN_BLOCK_TOOLTIPS.no_stores}
                </Typography>
              )}
              {runBlock === 'target_below_current' && (
                <Typography variant="caption" color="error">
                  {PLANNER_RUN_BLOCK_TOOLTIPS.target_below_current}
                </Typography>
              )}
              {runBlock === 'cap_too_tight' && (
                <Typography variant="caption" color="warning.main">
                  {PLANNER_RUN_BLOCK_TOOLTIPS.cap_too_tight}
                </Typography>
              )}
              {runBlock === 'target_out_of_range' && (
                <Typography variant="caption" color="error">
                  {PLANNER_RUN_BLOCK_TOOLTIPS.target_out_of_range}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        </Box>

        {!controlsOpen && showCollapsedPlay ? (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              pt: 1,
              flex: 1,
            }}
          >
            <Tooltip title={canRun ? 'Run simulation' : runTooltip} placement="right">
              <span>
                <IconButton
                  data-testid="collapsed-run"
                  color="primary"
                  onClick={handleRun}
                  disabled={!canRun}
                  aria-label="Run simulation"
                  size="small"
                >
                  {planMutation.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ) : null}
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: { xs: 'auto', md: 'hidden' },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          pb: { xs: 2, md: 0 },
        }}
      >
        {planMutation.isError && (
          <Alert severity="error" sx={{ flexShrink: 0 }}>
            {planMutation.error instanceof Error
              ? planMutation.error.message
              : 'Plan request failed'}
          </Alert>
        )}

        {draftPlan ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              overflow: { md: 'hidden' },
            }}
          >
            <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
              {isDirty && (
                <PlannerSandboxBar
                  targetPct={draftPlan.target}
                  horizonMonths={horizon}
                  hasAcceptedSnapshot={approvedPlan != null}
                  onDiscard={handleDiscardDraft}
                  onCommitSession={handleAcceptDraft}
                  onExportCsv={handleExportCsv}
                />
              )}

              {!isDirty && approvedPlan && (
                <Alert severity="success" icon={false} sx={{ alignItems: 'center' }}>
                  Committed session plan · Target {approvedPlan.target.toFixed(1)}% · Export anytime
                  from the left rail (still no DB write-back)
                </Alert>
              )}

              <SimulationSummaryKpis
                draftPlan={draftPlan}
                approvedPlan={approvedPlan}
                monitoring={monitoring}
              />
            </Stack>

            <Box
              data-testid="planner-explore-split"
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 1.5,
                overflow: { xs: 'visible', md: 'hidden' },
              }}
            >
              <Box
                sx={{
                  flex: { xs: 'none', md: monitoring ? '3 1 0%' : '1 1 0%' },
                  minWidth: 0,
                  minHeight: { xs: 'auto', md: 0 },
                  height: { md: '100%' },
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    flex: 1,
                    width: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    height: { md: '100%' },
                    display: 'flex',
                    flexDirection: 'column',
                    borderWidth: 2,
                    borderColor: 'primary.light',
                    overflow: 'hidden',
                  }}
                >
                  <CardHeader
                    title="Hero simulation"
                    subheader="Accepted / baseline vs draft · target line"
                    sx={{ flexShrink: 0, pb: 0 }}
                  />
                  <CardContent
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      pt: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      '&:last-child': { pb: 1.5 },
                    }}
                  >
                    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                      <HeroSimulationChart
                        draftPlan={draftPlan}
                        approvedPlan={approvedPlan}
                        slackBandPp={Math.min(2, params.max_monthly_improve * 0.35)}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {monitoring && (
                <Box
                  sx={{
                    flex: { xs: 'none', md: '2 1 0%' },
                    minWidth: 0,
                    minHeight: { xs: 280, md: 0 },
                    height: { md: '100%' },
                    display: 'flex',
                    overflow: 'hidden',
                  }}
                >
                  <Card
                    sx={{
                      flex: 1,
                      width: '100%',
                      minWidth: 0,
                      minHeight: 0,
                      height: { md: '100%' },
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <CardHeader
                      title="At-risk entities"
                      subheader="Exception list · Inspect opens store audit drawer"
                      sx={{ flexShrink: 0, pb: 0.5 }}
                    />
                    <CardContent
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        overflow: 'hidden',
                        pt: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        '&:last-child': { pb: 2 },
                      }}
                    >
                      <AtRiskDeltaTable
                        plan={draftPlan}
                        approvedPlan={approvedPlan}
                        baselineRows={baselineRows}
                        insights={monitoring}
                        asOfOptions={draftPlan.chain_trajectory.map((m) => ({
                          year: m.year,
                          month: m.month,
                        }))}
                        onAsOfChange={(year, month) => {
                          setAsOfYear(year);
                          setAsOfMonth(month);
                        }}
                        onInspect={(storeId) => selectStore(storeId)}
                      />
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>

            {panel && monitoring && selectedStoreId != null && (
              <StoreAuditDrawer
                open
                storeId={selectedStoreId}
                plan={draftPlan}
                panel={panel}
                insights={monitoring}
                processResult={processResult}
                maxMonthlyImprove={params.max_monthly_improve}
                onClose={() => selectStore(null)}
              />
            )}
          </Box>
        ) : (
          <Alert severity="info" sx={{ flexShrink: 0 }}>
            {baselineReady
              ? 'Set levers and Run simulation — canvas shows KPI strip, hero chart, and at-risk stores.'
              : 'Waiting for cleansed baseline from Sanitization…'}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
