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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
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
import { PlannerContextStrip } from '../components/planner/PlannerContextStrip';
import {
  PLANNER_RUN_BLOCK_MESSAGE_KEYS,
  plannerRunBlockReason,
} from '../components/planner/plannerRunGuards';
import { useT } from '../i18n';
import { ScenarioPackCards } from '../components/planner/ScenarioPackCards';
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
import {
  applyScenarioSurplusPass,
  getScenarioPack,
  type ScenarioPackId,
} from '../schemas/scenarioPacks';
import { redistributeSurplusToBehind } from '../schemas/surplusRedistribute';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';

const RAIL_WIDTH_PX = 320;
const RAIL_COLLAPSED_PX = 40;
/** Delay before showing collapsed Play so the collapse click cannot ghost-hit it. */
const COLLAPSED_PLAY_REVEAL_MS = 250;
/** Collapsed At-risk summary height reserved so Hero is not covered on md. */
const AT_RISK_SUMMARY_RESERVE_PX = 80;
/** Gap above At-risk overlay — same as KPI strip ↔ Hero (`gap: 1.5` → 12px). */
const AT_RISK_GAP_PX = 12;
/** Expanded At-risk overlay cap on md — scrolls internally; Hero underneath does not move. */
const AT_RISK_OVERLAY_MAX_HEIGHT = '45vh';
/** Prefer this month when present in the cleansed panel (DB demo path). */
const PREFERRED_REFERENCE = { year: 2025, month: 12 } as const;

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
  // Product lock: equal-weight store mean at reference month (not volume / Final period).
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
  const t = useT();
  const theme = useTheme();
  const processResult = useUiStore((state) => state.processResult);
  const planMutation = usePlan();

  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);
  const approvedPlan = usePlannerScenarioStore((s) => s.approvedPlan);
  const selectedStoreId = usePlannerScenarioStore((s) => s.selectedStoreId);
  const setDraftFromRun = usePlannerScenarioStore((s) => s.setDraftFromRun);
  const patchDraftPlan = usePlannerScenarioStore((s) => s.patchDraftPlan);
  const isDirty = usePlannerScenarioStore((s) => s.isDirty);
  const acceptDraftAsApproved = usePlannerScenarioStore((s) => s.acceptDraftAsApproved);
  const discardDraft = usePlannerScenarioStore((s) => s.discardDraft);
  const clearAll = usePlannerScenarioStore((s) => s.clearAll);
  const selectStore = usePlannerScenarioStore((s) => s.selectStore);

  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);
  const [atRiskExpanded, setAtRiskExpanded] = useState(false);

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

  const [referenceYear, setReferenceYear] = useState<number | null>(PREFERRED_REFERENCE.year);
  const [referenceMonth, setReferenceMonth] = useState<number | null>(PREFERRED_REFERENCE.month);
  const [target, setTarget] = useState(75);
  const [horizon, setHorizon] = useState(12);
  const [params, setParams] = useState<PlanParams>(DEFAULT_PLAN_PARAMS);
  const [asOfYear, setAsOfYear] = useState<number | null>(null);
  const [asOfMonth, setAsOfMonth] = useState<number | null>(null);
  /** EXP: clawback ahead when redistributing surplus (zero-sum). Default off → network rises. */
  const [expClawbackDonors, setExpClawbackDonors] = useState(false);
  const [expRedistributeNote, setExpRedistributeNote] = useState<string | null>(null);
  const [pendingPackId, setPendingPackId] = useState<ScenarioPackId | null>(null);

  const railWidth = controlsOpen ? RAIL_WIDTH_PX : RAIL_COLLAPSED_PX;

  useEffect(() => {
    if (controlsOpen) {
      setShowCollapsedPlay(false);
      return;
    }
    const timerId = window.setTimeout(() => setShowCollapsedPlay(true), COLLAPSED_PLAY_REVEAL_MS);
    return () => window.clearTimeout(timerId);
  }, [controlsOpen]);

  useEffect(() => {
    if (refs.length === 0) {
      return;
    }
    const selectionOk =
      referenceYear != null &&
      referenceMonth != null &&
      refs.some((ref) => ref.year === referenceYear && ref.month === referenceMonth);
    if (selectionOk) {
      return;
    }
    const preferred = refs.find(
      (ref) =>
        ref.year === PREFERRED_REFERENCE.year && ref.month === PREFERRED_REFERENCE.month,
    );
    const next = preferred ?? refs[refs.length - 1];
    setReferenceYear(next.year);
    setReferenceMonth(next.month);
  }, [refs, referenceYear, referenceMonth]);

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
  const runTooltip = runBlock ? t(PLANNER_RUN_BLOCK_MESSAGE_KEYS[runBlock]) : '';

  const monitoring = useMemo(() => {
    if (!draftPlan || !panel) {
      return null;
    }
    const fallback = defaultAsOf(draftPlan, panel);
    const year = asOfYear ?? fallback.year;
    const month = asOfMonth ?? fallback.month;
    return buildPlanMonitoringInsights(draftPlan, panel, { year, month });
  }, [draftPlan, panel, asOfYear, asOfMonth]);

  const canApplySurplusExp =
    draftPlan != null &&
    monitoring != null &&
    monitoring.summary.ahead > 0 &&
    monitoring.summary.behind > 0;

  const handleSurplusRedistribute = () => {
    if (!draftPlan || !monitoring) {
      return;
    }
    const result = redistributeSurplusToBehind(draftPlan, monitoring, {
      topDonors: 10,
      topReceivers: 10,
      harvestFraction: 0.5,
      clawbackDonors: expClawbackDonors,
    });
    setDraftFromRun(result.plan);
    setExpRedistributeNote(
      t('planner.exp.result', {
        pool: result.poolPp.toFixed(1),
        distributed: result.distributedPp.toFixed(1),
        leftover: result.leftoverPp.toFixed(1),
        delta: result.networkDeltaPp.toFixed(2),
        donors: result.donorIds.length,
        receivers: result.receiverIds.length,
        mode: result.mode,
      }),
    );
  };

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
          setExpRedistributeNote(null);
          if (panel) {
            const asOf = defaultAsOf(next, panel);
            setAsOfYear(asOf.year);
            setAsOfMonth(asOf.month);
          }
        },
      },
    );
  };

  const handleApplyScenarioPack = (packId: ScenarioPackId) => {
    if (!canRun || effectiveYear == null || effectiveMonth == null || !panel) {
      return;
    }
    const pack = getScenarioPack(packId);
    setParams(pack.params);
    if (pack.surplus) {
      setExpClawbackDonors(pack.surplus.clawbackDonors);
    }
    setPendingPackId(packId);
    planMutation.mutate(
      {
        reference_year: effectiveYear,
        reference_month: effectiveMonth,
        horizon,
        target,
        params: pack.params,
        baseline_rows: baselineRows,
      },
      {
        onSuccess: (response) => {
          const runPlan = response.metrics.five_percent;
          const asOf = defaultAsOf(runPlan, panel);
          setAsOfYear(asOf.year);
          setAsOfMonth(asOf.month);
          setDraftFromRun(runPlan);

          if (pack.surplus) {
            const pass = applyScenarioSurplusPass(runPlan, panel, asOf, pack.surplus);
            if (pass.applied && pass.result) {
              patchDraftPlan(pass.plan);
              setExpRedistributeNote(
                t('planner.packs.result.surplus', {
                  mode: pass.result.mode,
                  pool: pass.result.poolPp.toFixed(1),
                  delta: pass.result.networkDeltaPp.toFixed(2),
                }),
              );
            } else {
              setExpRedistributeNote(t('planner.packs.result.surplusSkipped'));
            }
          } else {
            setExpRedistributeNote(t('planner.packs.result.steady'));
          }
          setPendingPackId(null);
        },
        onError: () => {
          setPendingPackId(null);
        },
      },
    );
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
          <Tooltip
            title={controlsOpen ? t('common.collapseControls') : t('common.expandControls')}
            placement="right"
          >
            <IconButton
              size="small"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label={
                controlsOpen ? t('common.collapseControls') : t('common.expandControls')
              }
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
            overflowY: { xs: 'visible', md: 'hidden' },
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
                {t('planner.goSanitization')}
              </Button>
            }
          >
            {t('planner.needSanitization')}
          </Alert>
        )}

        <Card
          variant="outlined"
          data-testid="allocation-levers"
          sx={{
            flex: { xs: 'none', md: 1 },
            minHeight: { md: 0 },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <CardHeader
            title={t('planner.leversTitle')}
            sx={{ flexShrink: 0, pb: 0.5 }}
          />
          <CardContent
            sx={{
              pt: 1,
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              '&:last-child': { pb: 2 },
            }}
          >
            <Stack spacing={1.25}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ letterSpacing: 0.8 }}
              >
                {t('planner.section.goalTime')}
              </Typography>
              <TextField
                label={t('planner.target')}
                type="number"
                size="small"
                value={target}
                disabled={!baselineReady}
                onChange={(e) => setTarget(Number(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
              <TextField
                label={t('planner.horizon')}
                type="number"
                size="small"
                value={horizon}
                disabled={!baselineReady}
                onChange={(e) => setHorizon(Number(e.target.value))}
                inputProps={{ min: 1, max: 60 }}
              />
              <FormControl fullWidth size="small" disabled={!baselineReady || refs.length === 0}>
                <InputLabel id="ref-period-label">{t('planner.referenceMonth')}</InputLabel>
                <Select
                  labelId="ref-period-label"
                  label={t('planner.referenceMonth')}
                  value={
                    effectiveYear != null &&
                    effectiveMonth != null &&
                    refs.some((ref) => ref.year === effectiveYear && ref.month === effectiveMonth)
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
                    <MenuItem
                      key={periodLabel(ref.year, ref.month)}
                      value={periodLabel(ref.year, ref.month)}
                    >
                      {periodLabel(ref.year, ref.month)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack
                direction="row"
                spacing={1}
                alignItems="baseline"
                justifyContent="space-between"
                flexWrap="wrap"
                useFlexGap
              >
                <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 8rem' }}>
                  {t('planner.referenceMonthHint')}
                </Typography>
                <Typography
                  variant="body2"
                  data-testid="planner-current-chain"
                  sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                >
                  {t('planner.current')}{' '}
                  <strong>{currentChain == null ? '—' : `${currentChain.toFixed(2)}%`}</strong>
                </Typography>
              </Stack>

              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ letterSpacing: 0.8, pt: 0.5 }}
              >
                {t('planner.section.allocator')}
              </Typography>
              <TextField
                label={t('planner.maxMonthly')}
                type="number"
                size="small"
                value={params.max_monthly_improve}
                disabled={!baselineReady}
                onChange={(e) =>
                  setParams((p) => ({
                    ...p,
                    max_monthly_improve: Number(e.target.value),
                  }))
                }
                inputProps={{ min: 0.01, step: 0.1 }}
              />
              <TextField
                label={t('planner.priorityPower')}
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
                <InputLabel id="traj-label">{t('planner.trajectory')}</InputLabel>
                <Select
                  labelId="traj-label"
                  label={t('planner.trajectory')}
                  value={params.trajectory}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      trajectory: e.target.value as PlanParams['trajectory'],
                    }))
                  }
                >
                  <MenuItem value="uniform">{t('planner.traj.uniform')}</MenuItem>
                  <MenuItem value="front_loaded">{t('planner.traj.front')}</MenuItem>
                  <MenuItem value="accelerated">{t('planner.traj.accel')}</MenuItem>
                </Select>
              </FormControl>

              <Accordion
                disableGutters
                elevation={0}
                defaultExpanded={false}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption" fontWeight={600}>
                    {t('planner.advanced')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.25}>
                    <TextField
                      label={t('planner.trajPower')}
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
                      label={t('planner.growthFactor')}
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
                    {planMutation.isPending ? t('common.runningDots') : t('planner.run')}
                  </Button>
                </span>
              </Tooltip>
              <Stack direction="row" spacing={1}>
                <Tooltip title={draftPlan ? '' : t('planner.exportDisabledTip')}>
                  <span style={{ flex: 1 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      startIcon={<DownloadRoundedIcon />}
                      disabled={!draftPlan}
                      onClick={handleExportCsv}
                    >
                      {t('planner.exportCsv')}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    isDirty && approvedPlan
                      ? t('planner.revertDraftTip')
                      : t('planner.revertDraftDisabledTip')
                  }
                >
                  <span style={{ flex: 1 }}>
                    <Button
                      variant="text"
                      color="inherit"
                      fullWidth
                      size="small"
                      disabled={!isDirty || approvedPlan == null}
                      onClick={() => discardDraft()}
                      data-testid="planner-revert-draft"
                    >
                      {t('planner.revertDraft')}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>

              <Box
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}
                data-testid="scenario-packs-panel"
              >
                <ScenarioPackCards
                  disabled={!canRun || planMutation.isPending}
                  disabledTip={canRun ? '' : runTooltip}
                  pendingId={pendingPackId}
                  onApply={handleApplyScenarioPack}
                />
                {expRedistributeNote ? (
                  <Alert
                    severity="info"
                    sx={{ mt: 1, py: 0.5, '& .MuiAlert-message': { fontSize: '0.7rem' } }}
                  >
                    {expRedistributeNote}
                  </Alert>
                ) : null}
              </Box>

              <Accordion
                disableGutters
                elevation={0}
                defaultExpanded={false}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                data-testid="exp-surplus-redistribute"
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="caption" fontWeight={600}>
                    {t('planner.exp.surplusTitle')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {t('planner.exp.surplusHint')}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={expClawbackDonors}
                          onChange={(_, checked) => setExpClawbackDonors(checked)}
                          inputProps={{ 'aria-label': t('planner.exp.clawback') }}
                        />
                      }
                      label={
                        <Typography variant="caption">{t('planner.exp.clawback')}</Typography>
                      }
                    />
                    <Tooltip title={canApplySurplusExp ? '' : t('planner.exp.disabledTip')}>
                      <span>
                        <Button
                          variant="outlined"
                          color="secondary"
                          fullWidth
                          size="small"
                          startIcon={<ScienceRoundedIcon />}
                          disabled={!canApplySurplusExp}
                          onClick={handleSurplusRedistribute}
                        >
                          {t('planner.exp.apply')}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {runBlock === 'no_stores' && (
                <Typography variant="caption" color="warning.main">
                  {t(PLANNER_RUN_BLOCK_MESSAGE_KEYS.no_stores)}
                </Typography>
              )}
              {runBlock === 'target_below_current' && (
                <Typography variant="caption" color="error">
                  {t(PLANNER_RUN_BLOCK_MESSAGE_KEYS.target_below_current)}
                </Typography>
              )}
              {runBlock === 'cap_too_tight' && (
                <Typography variant="caption" color="warning.main">
                  {t(PLANNER_RUN_BLOCK_MESSAGE_KEYS.cap_too_tight)}
                </Typography>
              )}
              {runBlock === 'target_out_of_range' && (
                <Typography variant="caption" color="error">
                  {t(PLANNER_RUN_BLOCK_MESSAGE_KEYS.target_out_of_range)}
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
            <Tooltip title={canRun ? t('planner.run') : runTooltip} placement="right">
              <span>
                <IconButton
                  data-testid="collapsed-run"
                  color="primary"
                  onClick={handleRun}
                  disabled={!canRun}
                  aria-label={t('planner.run')}
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
              : t('planner.planFailed')}
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
            <Box
              data-testid="planner-glance-row"
              role="region"
              aria-label={t('planner.strip.aria')}
              sx={{
                flexShrink: 0,
                display: 'flex',
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: 0.75,
                width: '100%',
                overflowX: { md: 'auto' },
              }}
            >
              <PlannerContextStrip
                panel={panel}
                processResult={processResult}
                baselineReady={baselineReady}
                draftPlan={draftPlan}
                horizonMonths={horizon}
              />

              <SimulationSummaryKpis draftPlan={draftPlan} monitoring={monitoring} />
            </Box>

            <Box
              data-testid="planner-explore-stack"
              sx={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  minHeight: 320,
                  display: 'flex',
                  overflow: 'hidden',
                  pb:
                    panel && monitoring
                      ? { md: `${AT_RISK_SUMMARY_RESERVE_PX + AT_RISK_GAP_PX}px` }
                      : 0,
                }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    flex: 1,
                    width: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderWidth: 2,
                    borderColor: 'primary.light',
                    overflow: 'hidden',
                  }}
                >
                  <CardHeader
                    title={t('planner.heroTitle')}
                    subheader={t('planner.heroSub')}
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
                    {panel ? (
                      <HeroSimulationChart
                        draftPlan={draftPlan}
                        panel={panel}
                        asOfYear={
                          monitoring?.as_of_year ??
                          asOfYear ??
                          draftPlan.chain_trajectory[0]?.year ??
                          effectiveYear ??
                          new Date().getFullYear()
                        }
                        asOfMonth={
                          monitoring?.as_of_month ??
                          asOfMonth ??
                          draftPlan.chain_trajectory[0]?.month ??
                          effectiveMonth ??
                          1
                        }
                        slackBandPp={Math.min(2, params.max_monthly_improve * 0.35)}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('planner.heroNeedPanel')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {panel && monitoring && (
                <Box
                  data-testid="planner-at-risk-sheet"
                  sx={{
                    // xs: normal flow under Hero. md: bottom overlay over the pane.
                    position: { xs: 'relative', md: 'absolute' },
                    left: { md: 0 },
                    right: { md: 0 },
                    bottom: { md: AT_RISK_GAP_PX },
                    zIndex: { md: 3 },
                    flexShrink: 0,
                    maxHeight: { md: AT_RISK_OVERLAY_MAX_HEIGHT },
                    overflow: { md: 'auto' },
                    mt: { xs: `${AT_RISK_GAP_PX}px`, md: 0 },
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: { md: atRiskExpanded ? 8 : 2 },
                  }}
                >
                  <Accordion
                    disableGutters
                    expanded={atRiskExpanded}
                    onChange={(_event, expanded) => setAtRiskExpanded(expanded)}
                    sx={{
                      '&:before': { display: 'none' },
                      boxShadow: 'none',
                      bgcolor: 'transparent',
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ minHeight: 48, py: 0.5 }}
                    >
                      <Box sx={{ minWidth: 0, pr: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {t('planner.atRiskTitle')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          display="block"
                        >
                          {t('planner.atRisk.behindChip', {
                            count: monitoring.summary.behind,
                          })}
                          {' · '}
                          {t('planner.atRisk.aheadChip', {
                            count: monitoring.summary.ahead,
                          })}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        px: 1.5,
                        pt: 0,
                        pb: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        maxHeight: {
                          xs: '46vh',
                          md: `calc(${AT_RISK_OVERLAY_MAX_HEIGHT} - ${AT_RISK_SUMMARY_RESERVE_PX}px)`,
                        },
                        overflow: 'auto',
                      }}
                    >
                      <AtRiskDeltaTable
                        plan={draftPlan}
                        approvedPlan={approvedPlan}
                        baselineRows={baselineRows}
                        panel={panel}
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
                    </AccordionDetails>
                  </Accordion>
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
                onStoreChange={(id) => selectStore(id)}
                onApplyPlan={(next) => patchDraftPlan(next)}
              />
            )}
          </Box>
        ) : (
          <Alert severity="info" sx={{ flexShrink: 0 }}>
            {baselineReady ? t('planner.emptyReady') : t('planner.emptyWaiting')}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
