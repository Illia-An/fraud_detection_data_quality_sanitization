import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
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
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLoadTtsKpiFromAp, useTtsPlan } from '../api/hooks';
import { activeAnswerLabelKey } from '../components/planner/activeAnswer';
import { AtRiskPanelsSection } from '../components/planner/AtRiskPanelsSection';
import { HeroSimulationChart } from '../components/planner/HeroSimulationChart';
import { PlannerContextStrip } from '../components/planner/PlannerContextStrip';
import { ScenarioPackCards } from '../components/planner/ScenarioPackCards';
import { SimulationSummaryKpis } from '../components/planner/SimulationSummaryKpis';
import { StoreAuditDrawer } from '../components/planner/StoreAuditDrawer';
import { StoreMixQuestionCards } from '../components/planner/StoreMixQuestionCards';
import { formatPathLeversSummary } from '../components/planner/plannerPathLeversSummary';
import {
  TTS_PLANNER_RUN_BLOCK_MESSAGE_KEYS,
  ttsPlannerRunBlockReason,
} from '../components/ttsPlanner/ttsPlannerRunGuards';
import { useT } from '../i18n';
import { periodLabel } from '../schemas/plan';
import { buildPlanMonitoringInsights, defaultAsOf } from '../schemas/planMonitoring';
import { getScenarioPack, type ScenarioPackId } from '../schemas/scenarioPacks';
import {
  getStoreMixQuestion,
  type StoreMixQuestionId,
} from '../schemas/storeMixQuestions';
import { buildTtsExcelReportRequest } from '../schemas/excelReport';
import { redistributeSurplusToBehind } from '../schemas/surplusRedistribute';
import type { TtsKpiPanel } from '../schemas/ttsKpiPanel';
import type { TtsPlan, TtsPlanParams } from '../schemas/ttsPlan';
import {
  TTS_PLAN_DEFAULT_MAX_MONTHLY,
  TTS_PLAN_DEFAULT_TARGET,
  TTS_PLAN_TARGET_MAX,
  TTS_PLAN_TARGET_MIN,
} from '../schemas/ttsPlan';
import { PlannerPageShell } from '../components/planner/PlannerPageShell';
import { useAnswerShell } from '../components/planner/useAnswerShell';
import { usePlannerOnboardingShell } from '../components/planner/usePlannerOnboardingShell';
import { useReferenceSelection } from '../components/planner/useReferenceSelection';
import {
  availablePeriodReferences,
  baselineRowsAtReference,
  equalWeightMeanBy,
} from '../components/planner/plannerBaseline';
import { downloadPlanProjectionCsv } from '../components/planner/plannerCsv';
import {
  ttsGoalClamps,
  usePlannerGoalDrafts,
} from '../components/planner/usePlannerGoalDrafts';
import {
  canExportPlanExcel,
  usePlannerExcelExport,
} from '../components/planner/usePlannerExcelExport';
import { useTtsPlannerScenarioStore } from '../store/ttsPlannerScenarioStore';
import { CONTROLS_RAIL_ROUTE, useControlsRailOpen } from '../store/uiStore';

const TTS_FLOOR = TTS_PLAN_TARGET_MIN;
const TTS_CEILING = TTS_PLAN_TARGET_MAX;
const TTS_MONITOR_BAND_MIN = 0.05;

export function TtsPlannerPage() {
  const t = useT();
  const loadAp = useLoadTtsKpiFromAp();
  const planMutation = useTtsPlan();
  const draftPlan = useTtsPlannerScenarioStore((state) => state.draftPlan);
  const approvedPlan = useTtsPlannerScenarioStore((state) => state.approvedPlan);
  const isDirty = useTtsPlannerScenarioStore((state) => state.isDirty);
  const setDraftFromRun = useTtsPlannerScenarioStore((state) => state.setDraftFromRun);
  const patchDraftPlan = useTtsPlannerScenarioStore((state) => state.patchDraftPlan);
  const acceptDraftAsApproved = useTtsPlannerScenarioStore((state) => state.acceptDraftAsApproved);
  const selectedStoreId = useTtsPlannerScenarioStore((state) => state.selectedStoreId);
  const selectStore = useTtsPlannerScenarioStore((state) => state.selectStore);
  const discardDraft = useTtsPlannerScenarioStore((state) => state.discardDraft);
  const clearAll = useTtsPlannerScenarioStore((state) => state.clearAll);
  const panel = useTtsPlannerScenarioStore((state) => state.panel);
  const setPanel = useTtsPlannerScenarioStore((state) => state.setPanel);

  const [controlsOpen, setControlsOpen] = useControlsRailOpen(
    CONTROLS_RAIL_ROUTE.ttsPlanner,
  );
  const apLoadStarted = useRef(false);
  const {
    target,
    horizon,
    targetText,
    horizonText,
    commitGoalDrafts,
    onTargetChange,
    onHorizonChange,
    onTargetBlur,
    onHorizonBlur,
  } = usePlannerGoalDrafts({
    initialTarget: TTS_PLAN_DEFAULT_TARGET,
    initialHorizon: 12,
    ...ttsGoalClamps,
  });
  const [maxMonthly, setMaxMonthly] = useState(TTS_PLAN_DEFAULT_MAX_MONTHLY);
  const [priorityPower, setPriorityPower] = useState(1);
  const [trajectory, setTrajectory] = useState<'uniform' | 'front_loaded' | 'accelerated'>(
    'uniform',
  );
  const {
    pendingPackId,
    setPendingPackId,
    pendingMixId,
    setPendingMixId,
    activeAnswer,
    setActiveAnswer,
    mixNote,
    setMixNote,
    answerUndo,
    resetAnswerState,
    captureUndo,
    clearUndo,
    consumeUndo,
  } = useAnswerShell<TtsPlan, TtsPlanParams>();
  const [asOfYear, setAsOfYear] = useState<number | null>(null);
  const [asOfMonth, setAsOfMonth] = useState<number | null>(null);
  /** Onboarding still toggles this; panels are always visible (no accordion). */
  const [, setAtRiskExpanded] = useState(false);
  const { excelExporting, excelExportError, exportExcel } = usePlannerExcelExport();

  // Expand/collapse rail & At-risk so tour targets stay visible without covering Hero on Back.
  usePlannerOnboardingShell({ prefix: 'tts-planner', setControlsOpen, setAtRiskExpanded });

  const params: TtsPlanParams = {
    trajectory,
    trajectory_power: 2,
    priority_power: priorityPower,
    max_monthly_improve: maxMonthly,
    growth_factor: 0.5,
  };

  const refs = useMemo(
    () => (panel ? availablePeriodReferences(panel.rows) : []),
    [panel],
  );

  const { referenceYear, referenceMonth, setReferenceYear, setReferenceMonth } =
    useReferenceSelection(refs);

  const effectiveYear = referenceYear ?? panel?.reference_year ?? null;
  const effectiveMonth = referenceMonth ?? panel?.reference_month ?? null;
  const baselineRows =
    panel && effectiveYear != null && effectiveMonth != null
      ? baselineRowsAtReference(panel.rows, effectiveYear, effectiveMonth, (row) => ({
          store_id: row.store_id,
          tts: row.tts,
        }))
      : [];
  const currentChain = equalWeightMeanBy(baselineRows, (row) => row.tts);
  const baselineReady = panel != null && panel.row_count > 0;
  const directionKey =
    currentChain == null
      ? null
      : target < currentChain - 1e-9
        ? 'ttsPlanner.dir.improve'
        : target > currentChain + 1e-9
          ? 'ttsPlanner.dir.invalid'
          : 'ttsPlanner.dir.hold';

  const monitoring = useMemo(() => {
    if (!draftPlan || !panel) {
      return null;
    }
    const fallback = defaultAsOf(draftPlan, panel);
    const year = asOfYear ?? fallback.year;
    const month = asOfMonth ?? fallback.month;
    return buildPlanMonitoringInsights(draftPlan, panel, { year, month }, TTS_MONITOR_BAND_MIN);
  }, [draftPlan, panel, asOfYear, asOfMonth]);

  const canApplyStoreMix =
    draftPlan != null &&
    monitoring != null &&
    monitoring.summary.ahead > 0 &&
    monitoring.summary.behind > 0;

  const applyLoadedPanel = useCallback(
    (next: TtsKpiPanel) => {
      clearAll();
      setPanel(next);
      resetAnswerState();
      setAsOfYear(null);
      setAsOfMonth(null);
    },
    [clearAll, setPanel, resetAnswerState],
  );

  useEffect(() => {
    if (panel != null || apLoadStarted.current) {
      return;
    }
    apLoadStarted.current = true;
    loadAp.mutate(undefined, { onSuccess: applyLoadedPanel });
  }, [panel, loadAp, applyLoadedPanel]);

  const captureAnswerUndo = () => captureUndo({ plan: draftPlan, params });

  const handleUndoAnswer = () => {
    const snap = consumeUndo();
    if (!snap) {
      return;
    }
    setTrajectory(snap.params.trajectory);
    setPriorityPower(snap.params.priority_power);
    setMaxMonthly(snap.params.max_monthly_improve);
    if (snap.plan) {
      patchDraftPlan(snap.plan);
    } else {
      clearAll();
    }
  };

  const applyAsOf = (plan: TtsPlan) => {
    if (!panel) {
      return;
    }
    const asOf = defaultAsOf(plan, panel);
    setAsOfYear(asOf.year);
    setAsOfMonth(asOf.month);
  };

  const runBlock = ttsPlannerRunBlockReason({
    baselineReady,
    storeCount: baselineRows.length,
    currentChain,
    target,
    horizon,
    maxMonthlyImprove: maxMonthly,
    isPending: planMutation.isPending,
  });
  const canRun = runBlock == null;
  const runTip = runBlock ? t(TTS_PLANNER_RUN_BLOCK_MESSAGE_KEYS[runBlock]) : '';

  const handleRun = () => {
    const goal = commitGoalDrafts();
    const block = ttsPlannerRunBlockReason({
      baselineReady,
      storeCount: baselineRows.length,
      currentChain,
      target: goal.target,
      horizon: goal.horizon,
      maxMonthlyImprove: maxMonthly,
      isPending: planMutation.isPending,
    });
    if (block != null || effectiveYear == null || effectiveMonth == null) {
      return;
    }
    const undoSnap = captureAnswerUndo();
    planMutation.mutate(
      {
        reference_year: effectiveYear,
        reference_month: effectiveMonth,
        horizon: goal.horizon,
        target: goal.target,
        params: {
          trajectory,
          trajectory_power: 2,
          priority_power: priorityPower,
          max_monthly_improve: maxMonthly,
          growth_factor: 0.5,
        },
        baseline_rows: baselineRows,
      },
      {
        onSuccess: (response) => {
          const next = response.metrics.tts;
          setDraftFromRun(next);
          setMixNote(null);
          setActiveAnswer({ kind: 'manual' });
          applyAsOf(next);
        },
        onError: () => {
          setTrajectory(undoSnap.params.trajectory);
          setPriorityPower(undoSnap.params.priority_power);
          setMaxMonthly(undoSnap.params.max_monthly_improve);
          clearUndo();
        },
      },
    );
  };

  const handleApplyScenarioPack = (packId: ScenarioPackId) => {
    const goal = commitGoalDrafts();
    const block = ttsPlannerRunBlockReason({
      baselineReady,
      storeCount: baselineRows.length,
      currentChain,
      target: goal.target,
      horizon: goal.horizon,
      maxMonthlyImprove: maxMonthly,
      isPending: planMutation.isPending,
    });
    if (block != null || effectiveYear == null || effectiveMonth == null || !panel) {
      return;
    }
    const undoSnap = captureAnswerUndo();
    const pack = getScenarioPack(packId);
    const packParams: TtsPlanParams = {
      ...params,
      trajectory: pack.params.trajectory,
      trajectory_power: pack.params.trajectory_power,
      priority_power: pack.params.priority_power,
      max_monthly_improve: maxMonthly,
    };
    setTrajectory(packParams.trajectory);
    setPriorityPower(packParams.priority_power);
    setPendingPackId(packId);
    planMutation.mutate(
      {
        reference_year: effectiveYear,
        reference_month: effectiveMonth,
        horizon: goal.horizon,
        target: goal.target,
        params: packParams,
        baseline_rows: baselineRows,
      },
      {
        onSuccess: (response) => {
          const next = response.metrics.tts;
          applyAsOf(next);
          setDraftFromRun(next);
          setMixNote(t('planner.packs.result.applied'));
          setActiveAnswer({ kind: 'pack', id: packId });
          setPendingPackId(null);
        },
        onError: () => {
          setPendingPackId(null);
          setTrajectory(undoSnap.params.trajectory);
          setPriorityPower(undoSnap.params.priority_power);
          setMaxMonthly(undoSnap.params.max_monthly_improve);
          clearUndo();
        },
      },
    );
  };

  const handleApplyStoreMix = (questionId: StoreMixQuestionId) => {
    if (!draftPlan || !monitoring || !canApplyStoreMix) {
      return;
    }
    captureAnswerUndo();
    const recipe = getStoreMixQuestion(questionId);
    setPendingMixId(questionId);
    const result = redistributeSurplusToBehind(draftPlan, monitoring, {
      topDonors: recipe.topDonors,
      topReceivers: recipe.topReceivers,
      harvestFraction: recipe.harvestFraction,
      clawbackDonors: recipe.clawbackDonors,
      floor: TTS_FLOOR,
      ceiling: TTS_CEILING,
    });
    setDraftFromRun(result.plan);
    setActiveAnswer({ kind: 'mix', id: questionId });
    setMixNote(
      t('ttsPlanner.mix.result', {
        pool: result.poolPp.toFixed(2),
        distributed: result.distributedPp.toFixed(2),
        leftover: result.leftoverPp.toFixed(2),
        delta: result.networkDeltaPp.toFixed(2),
        donors: result.donorIds.length,
        receivers: result.receiverIds.length,
        mode: result.mode,
      }),
    );
    setPendingMixId(null);
  };

  const handleExport = () => {
    if (!draftPlan) {
      return;
    }
    downloadPlanProjectionCsv(draftPlan, 'plan_tts_projections.csv');
    acceptDraftAsApproved();
  };

  const canExportExcel = canExportPlanExcel(draftPlan, panel);

  const handleExportExcel = () => {
    if (!draftPlan || !panel) {
      return;
    }
    exportExcel({
      canExport: canExportExcel,
      filename: 'tts-plan-report.xlsx',
      buildRequest: () => buildTtsExcelReportRequest(panel, draftPlan),
    });
  };

  return (
    <PlannerPageShell
      controlsOpen={controlsOpen}
      onToggleControls={() => setControlsOpen((open) => !open)}
      railTestId="tts-controls-rail"
      rail={
        <>
          {!baselineReady && (
            <Alert severity="info" data-testid="tts-planner-need-baseline">
              {t('ttsPlanner.needBaseline')}
            </Alert>
          )}
          {loadAp.isPending && !baselineReady && (
            <Alert severity="info" data-testid="tts-planner-loading-ap">
              {t('ttsPlanner.loadingAp')}
            </Alert>
          )}
          {loadAp.isError && (
            <Alert severity="error" data-testid="tts-planner-ap-failed">
              {t('ttsPlanner.apFailed')}
            </Alert>
          )}

          <Card
            variant="outlined"
            data-testid="tts-allocation-levers"
            data-onboarding="tts-planner-levers"
            sx={{
              flex: { xs: 'none', md: 1 },
              minHeight: { md: 0 },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardHeader
              title={t('ttsPlanner.leversTitle')}
              subheader={t('ttsPlanner.leversSub')}
              sx={{ flexShrink: 0, pb: 0.5 }}
            />
            <CardContent
              sx={{
                pt: 1,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                scrollbarGutter: 'stable',
                '&:last-child': { pb: 2 },
              }}
            >
              <Stack spacing={1.25}>
                <Typography variant="overline" color="text.secondary">
                  {t('ttsPlanner.section.goalTime')}
                </Typography>
                <TextField
                  label={t('ttsPlanner.target')}
                  size="small"
                  value={targetText}
                  disabled={!baselineReady}
                  onChange={(event) => onTargetChange(event.target.value)}
                  onBlur={onTargetBlur}
                  inputProps={{ inputMode: 'decimal', 'aria-label': t('ttsPlanner.target') }}
                  helperText={t('ttsPlanner.targetHint')}
                />
                <TextField
                  label={t('ttsPlanner.horizon')}
                  size="small"
                  value={horizonText}
                  disabled={!baselineReady}
                  onChange={(event) => onHorizonChange(event.target.value)}
                  onBlur={onHorizonBlur}
                  inputProps={{ inputMode: 'numeric', 'aria-label': t('ttsPlanner.horizon') }}
                  helperText={t('ttsPlanner.horizonHint')}
                />
                <FormControl fullWidth size="small" disabled={!baselineReady || refs.length === 0}>
                  <InputLabel id="tts-ref-label">{t('ttsPlanner.referenceMonth')}</InputLabel>
                  <Select
                    labelId="tts-ref-label"
                    label={t('ttsPlanner.referenceMonth')}
                    value={
                      effectiveYear != null && effectiveMonth != null
                        ? periodLabel(effectiveYear, effectiveMonth)
                        : ''
                    }
                    onChange={(event) => {
                      const [year, month] = event.target.value.split('-').map(Number);
                      setReferenceYear(year);
                      setReferenceMonth(month);
                      clearAll();
                    }}
                    inputProps={{ 'aria-label': t('ttsPlanner.referenceMonth') }}
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
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography
                    variant="body2"
                    data-testid="tts-planner-current-chain"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t('ttsPlanner.current')}{' '}
                    <strong>
                      {currentChain == null ? '—' : `${currentChain.toFixed(2)} min`}
                    </strong>
                  </Typography>
                  <Chip size="small" label={t('ttsPlanner.direction')} color="primary" variant="outlined" />
                  {directionKey ? (
                    <Chip size="small" label={t(directionKey)} variant="outlined" />
                  ) : null}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('ttsPlanner.referenceMonthHint')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('ttsPlanner.storesAtRef', { count: baselineRows.length })}
                </Typography>

                <ScenarioPackCards
                  disabled={!canRun || pendingPackId != null}
                  disabledTip={runTip || t('planner.packs.disabledTip')}
                  pendingId={pendingPackId}
                  pathParams={params}
                  summaryText={formatPathLeversSummary(params, t).replace(' pp', ' min')}
                  blurbOverrides={{ close_gap: 'ttsPlanner.packs.closeGap.blurb' }}
                  onApply={handleApplyScenarioPack}
                />
                <StoreMixQuestionCards
                  disabled={!canApplyStoreMix || pendingMixId != null}
                  disabledTip={t('planner.mix.disabledTip')}
                  pendingId={pendingMixId}
                  blurbOverrides={{
                    lift_behind: 'ttsPlanner.mix.liftBehind.blurb',
                    rebalance_flat: 'ttsPlanner.mix.rebalance.blurb',
                  }}
                  onApply={handleApplyStoreMix}
                />
                {mixNote ? (
                  <Typography variant="caption" color="text.secondary" data-testid="tts-planner-mix-note">
                    {mixNote}
                  </Typography>
                ) : null}

                <Accordion disableGutters elevation={0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">{t('ttsPlanner.advanced')}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.25}>
                      <Typography variant="overline" color="text.secondary">
                        {t('ttsPlanner.section.allocator')}
                      </Typography>
                      <TextField
                        label={t('ttsPlanner.maxMonthly')}
                        type="number"
                        size="small"
                        value={maxMonthly}
                        disabled={!baselineReady}
                        onChange={(event) => setMaxMonthly(Number(event.target.value))}
                        inputProps={{ min: 0.01, step: 0.05, 'aria-label': t('ttsPlanner.maxMonthly') }}
                      />
                      <TextField
                        label={t('ttsPlanner.priorityPower')}
                        type="number"
                        size="small"
                        value={priorityPower}
                        disabled={!baselineReady}
                        onChange={(event) => setPriorityPower(Number(event.target.value))}
                        inputProps={{ min: 0.1, step: 0.1, 'aria-label': t('ttsPlanner.priorityPower') }}
                      />
                      <FormControl fullWidth size="small" disabled={!baselineReady}>
                        <InputLabel id="tts-traj-label">{t('ttsPlanner.trajectory')}</InputLabel>
                        <Select
                          labelId="tts-traj-label"
                          label={t('ttsPlanner.trajectory')}
                          value={trajectory}
                          onChange={(event) =>
                            setTrajectory(
                              event.target.value as 'uniform' | 'front_loaded' | 'accelerated',
                            )
                          }
                        >
                          <MenuItem value="uniform">{t('ttsPlanner.traj.uniform')}</MenuItem>
                          <MenuItem value="front_loaded">{t('ttsPlanner.traj.front')}</MenuItem>
                          <MenuItem value="accelerated">{t('ttsPlanner.traj.accel')}</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {runBlock === 'target_above_current' && (
                  <Typography variant="caption" color="error">
                    {t('ttsPlanner.block.targetAbove')}
                  </Typography>
                )}
                {runBlock === 'cap_too_tight' && (
                  <Typography variant="caption" color="warning.main">
                    {t('ttsPlanner.block.capTight')}
                  </Typography>
                )}

                <Tooltip title={runTip}>
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
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
                      data-testid="tts-planner-run"
                    >
                      {planMutation.isPending ? t('ttsPlanner.block.running') : t('ttsPlanner.run')}
                    </Button>
                  </span>
                </Tooltip>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<DownloadRoundedIcon />}
                    disabled={!draftPlan}
                    onClick={handleExport}
                    data-testid="tts-planner-export"
                  >
                    {t('ttsPlanner.exportCsv')}
                  </Button>
                  <Tooltip title={canExportExcel ? '' : t('ttsPlanner.exportExcelDisabledTip')}>
                    <span style={{ flex: 1 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        size="small"
                        startIcon={
                          excelExporting ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <DownloadRoundedIcon />
                          )
                        }
                        disabled={!canExportExcel || excelExporting}
                        onClick={handleExportExcel}
                        data-testid="tts-planner-export-excel"
                      >
                        {t('ttsPlanner.exportExcel')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Button
                    variant="text"
                    color="warning"
                    fullWidth
                    size="small"
                    disabled={!isDirty || approvedPlan == null}
                    onClick={() => discardDraft()}
                    data-testid="tts-planner-revert"
                  >
                    {t('ttsPlanner.revertDraft')}
                  </Button>
                </Stack>
                {excelExportError ? (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {t('ttsPlanner.exportExcelFailed')}
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </>
      }
    >
        {!baselineReady && (
          <Alert severity="info" sx={{ flexShrink: 0 }}>
            {t('ttsPlanner.emptyWaiting')}
          </Alert>
        )}
        {planMutation.isError && (
          <Alert severity="error" sx={{ flexShrink: 0 }}>
            {planMutation.error instanceof Error
              ? planMutation.error.message
              : t('ttsPlanner.planFailed')}
          </Alert>
        )}

        {draftPlan && panel ? (
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
              data-testid="tts-planner-context"
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
              {activeAnswer || answerUndo ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ alignSelf: 'center', flexShrink: 0 }}
                >
                  {activeAnswer ? (
                    <Chip
                      color="primary"
                      variant="outlined"
                      size="small"
                      data-testid="planner-active-answer"
                      label={t('planner.answer.chip', {
                        label: t(activeAnswerLabelKey(activeAnswer)),
                      })}
                      sx={{
                        fontWeight: 600,
                        maxWidth: { xs: '100%', md: 240 },
                        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                      }}
                    />
                  ) : null}
                  {answerUndo ? (
                    <Tooltip title={t('planner.answer.undoTip')}>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<UndoRoundedIcon fontSize="small" />}
                        onClick={handleUndoAnswer}
                        data-testid="planner-undo-answer"
                        sx={{ flexShrink: 0, minWidth: 0, px: 1 }}
                      >
                        {t('planner.answer.undo')}
                      </Button>
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : null}
              <PlannerContextStrip
                panel={null}
                processResult={null}
                baselineReady={baselineReady}
                baselineLabel={t('ttsPlanner.baseline.ready', {
                  rows: panel.row_count.toLocaleString(),
                })}
                draftPlan={draftPlan}
                horizonMonths={horizon}
              />
              <SimulationSummaryKpis
                draftPlan={draftPlan}
                monitoring={monitoring}
                projectedTestId="tts-planner-plan-summary"
              />
            </Box>

            <Box
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
                }}
              >
                <Card
                  variant="outlined"
                  data-testid="tts-planner-hero"
                  data-onboarding="tts-planner-hero"
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
                      slackBandPp={Math.min(0.5, maxMonthly * 0.35)}
                      yAxisTitle="min"
                      tickSuffix=" min"
                      scoreFloor={TTS_FLOOR}
                      scoreCeiling={TTS_CEILING}
                      scrollAnchor="asOf"
                    />
                  </CardContent>
                </Card>
              </Box>

              {monitoring ? (
                <AtRiskPanelsSection
                  testId="tts-planner-at-risk"
                  onboardingId="tts-planner-at-risk"
                  plan={draftPlan}
                  approvedPlan={approvedPlan}
                  baselineRows={baselineRows.map((row) => ({
                    store_id: row.store_id,
                    tts: row.tts,
                  }))}
                  panel={panel}
                  insights={monitoring}
                  asOfOptions={draftPlan.chain_trajectory.map((point) => ({
                    year: point.year,
                    month: point.month,
                  }))}
                  onAsOfChange={(year, month) => {
                    setAsOfYear(year);
                    setAsOfMonth(month);
                  }}
                  onInspect={(storeId) => selectStore(storeId)}
                  inspectOnboardingId="tts-planner-inspect"
                />
              ) : null}
            </Box>
          </Box>
        ) : (
          <>
            <Card
              variant="outlined"
              data-testid="tts-planner-hero"
              data-onboarding="tts-planner-hero"
              sx={{ flexShrink: 0 }}
            >
              <CardHeader title={t('planner.heroTitle')} subheader={t('planner.heroSub')} />
              <CardContent>
                <Typography color="text.secondary">{t('ttsPlanner.heroEmpty')}</Typography>
              </CardContent>
            </Card>
            <Card
              variant="outlined"
              data-testid="tts-planner-at-risk"
              data-onboarding="tts-planner-at-risk"
              sx={{ flexShrink: 0 }}
            >
              <CardHeader title={t('planner.atRiskTitle')} />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {t('ttsPlanner.atRiskEmpty')}
                </Typography>
              </CardContent>
            </Card>
          </>
        )}
        {draftPlan && panel && monitoring && selectedStoreId != null && (
          <StoreAuditDrawer
            open
            storeId={selectedStoreId}
            plan={draftPlan}
            panel={panel}
            insights={monitoring}
            processResult={null}
            maxMonthlyImprove={maxMonthly}
            baselineRows={baselineRows.map((row) => ({
              store_id: row.store_id,
              tts: row.tts,
            }))}
            onClose={() => selectStore(null)}
            onStoreChange={(storeId) => selectStore(storeId)}
            onApplyPlan={(next) => patchDraftPlan(next)}
            yAxisTitle="min"
            tickSuffix=" min"
          />
        )}
    </PlannerPageShell>
  );
}

