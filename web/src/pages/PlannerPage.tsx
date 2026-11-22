import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import {
  usePlan,
  useRunSimulation,
  useSavePlanVersion,
} from '../api/hooks';
import { AtRiskPanelsSection } from '../components/planner/AtRiskPanelsSection';
import { activeAnswerLabelKey } from '../components/planner/activeAnswer';
import { buildNetworkCumulativeSlopeLayers } from '../components/planner/cumulativeSlopeLayers';
import { SlopeCumulativePanel } from '../components/planner/SlopeCumulativePanel';
import { SlopeMonthlyPanel } from '../components/planner/SlopeMonthlyPanel';
import {
  FIGMA_CONTROLS_FIELD_GAP_PX,
  FIGMA_CONTROLS_PADDING_PX,
  FIGMA_CONTROLS_SECTION_GAP_PX,
  FIGMA_FONT_MONO,
  FIGMA_RUN_BUTTON_HEIGHT_PX,
  FIGMA_SECONDARY_BUTTON_HEIGHT_PX,
} from '../components/planner/figmaPlannerLayout';
import {
  NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
  NETWORK_SLOPE_CHART_GAP_PX,
  PLANNER_ANALYTICS_PADDING_PX,
  PLANNER_ANALYTICS_SECTION_GAP_PX,
} from '../components/planner/slopeHeroShared';
import { panelToSimulationFacts } from '../components/planner/panelToSimulationFacts';
import { PlannerContextStrip } from '../components/planner/PlannerContextStrip';
import {
  PLANNER_RUN_BLOCK_MESSAGE_KEYS,
  plannerRunBlockReason,
} from '../components/planner/plannerRunGuards';
import { useT } from '../i18n';
import { ScenarioPackCards } from '../components/planner/ScenarioPackCards';
import { SimulationSummaryKpis } from '../components/planner/SimulationSummaryKpis';
import { StoreMixQuestionCards } from '../components/planner/StoreMixQuestionCards';
import {
  buildExcelReportRequest,
  buildExcelReportRequestFromSimulation,
} from '../schemas/excelReport';
import { buildSanitizedPanelFromProcess } from '../schemas/sanitizedPanel';
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
import { getScenarioPack, type ScenarioPackId } from '../schemas/scenarioPacks';
import {
  getStoreMixQuestion,
  type StoreMixQuestionId,
} from '../schemas/storeMixQuestions';
import { redistributeSurplusToBehind } from '../schemas/surplusRedistribute';
import { usePlannerRuntimeStore } from '../store/plannerRuntimeStore';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { PLANNER_PREFERRED_REFERENCE } from '../components/planner/plannerShell';
import { PlannerPageShell } from '../components/planner/PlannerPageShell';
import { useCollapsedPlayReveal } from '../components/planner/useCollapsedPlayReveal';
import { usePlannerOnboardingShell } from '../components/planner/usePlannerOnboardingShell';
import { useAnswerShell } from '../components/planner/useAnswerShell';
import {
  fivePercentGoalClamps,
  usePlannerGoalDrafts,
} from '../components/planner/usePlannerGoalDrafts';
import {
  canExportPlanExcel,
  usePlannerExcelExport,
} from '../components/planner/usePlannerExcelExport';
import { useReferenceSelection } from '../components/planner/useReferenceSelection';
import { CONTROLS_RAIL_ROUTE, useControlsRailOpen, useUiStore } from '../store/uiStore';
import {
  availablePeriodReferences,
  baselineRowsAtReference,
  equalWeightMeanBy,
} from '../components/planner/plannerBaseline';
import { downloadPlanProjectionCsv } from '../components/planner/plannerCsv';

export function PlannerPage() {
  const t = useT();
  const navigate = useNavigate();
  const processResult = useUiStore((state) => state.processResult);
  const planMutation = usePlan();

  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);
  const approvedPlan = usePlannerScenarioStore((s) => s.approvedPlan);
  const setDraftFromRun = usePlannerScenarioStore((s) => s.setDraftFromRun);
  const patchDraftPlan = usePlannerScenarioStore((s) => s.patchDraftPlan);
  const isDirty = usePlannerScenarioStore((s) => s.isDirty);
  const acceptDraftAsApproved = usePlannerScenarioStore((s) => s.acceptDraftAsApproved);
  const discardDraft = usePlannerScenarioStore((s) => s.discardDraft);
  const clearAll = usePlannerScenarioStore((s) => s.clearAll);
  const activePlanVersionId = usePlannerScenarioStore((s) => s.activePlanVersionId);
  const setActivePlanVersionId = usePlannerScenarioStore((s) => s.setActivePlanVersionId);
  const slopeSimulation = usePlannerRuntimeStore((s) => s.slopeSimulation);
  const setSlopeSimulation = usePlannerRuntimeStore((s) => s.setSlopeSimulation);
  const setMaxMonthlyImprove = usePlannerRuntimeStore((s) => s.setMaxMonthlyImprove);
  const setImpliedAdjustments = usePlannerRuntimeStore((s) => s.setImpliedAdjustments);
  const clearSlopeRuntime = usePlannerRuntimeStore((s) => s.clear);

  const simulationMutation = useRunSimulation();
  const savePlanMutation = useSavePlanVersion();

  const [controlsOpen, setControlsOpen] = useControlsRailOpen(CONTROLS_RAIL_ROUTE.planner);
  const showCollapsedPlay = useCollapsedPlayReveal(controlsOpen);
  /** Onboarding still toggles this; At-risk is a full second viewport (no accordion). */
  const [, setAtRiskExpanded] = useState(false);
  const atRiskScreenRef = useRef<HTMLDivElement | null>(null);
  const { excelExporting, excelExportError, exportExcel } = usePlannerExcelExport();
  const slopeLayers = useMemo(
    () => (slopeSimulation ? buildNetworkCumulativeSlopeLayers(slopeSimulation) : null),
    [slopeSimulation],
  );
  const [savePlanError, setSavePlanError] = useState(false);
  const [savePlanOk, setSavePlanOk] = useState(false);

  // Expand/collapse rail & At-risk so tour targets stay visible without covering Hero on Back.
  usePlannerOnboardingShell({ prefix: 'planner', setControlsOpen, setAtRiskExpanded });

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

  const refs = useMemo(
    () => (panel ? availablePeriodReferences(panel.rows) : []),
    [panel],
  );
  const suggested = refs.length ? refs[refs.length - 1] : null;

  const { referenceYear, referenceMonth, setReferenceYear, setReferenceMonth } =
    useReferenceSelection(refs, PLANNER_PREFERRED_REFERENCE);
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
    initialTarget: 75,
    initialHorizon: 12,
    ...fivePercentGoalClamps,
  });
  const [params, setParams] = useState<PlanParams>(DEFAULT_PLAN_PARAMS);
  const [asOfYear, setAsOfYear] = useState<number | null>(null);
  const [asOfMonth, setAsOfMonth] = useState<number | null>(null);
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
  } = useAnswerShell<FivePercentPlan, PlanParams>();

  const effectiveYear = referenceYear ?? suggested?.year ?? null;
  const effectiveMonth = referenceMonth ?? suggested?.month ?? null;

  const baselineRows =
    panel && effectiveYear != null && effectiveMonth != null
      ? baselineRowsAtReference(panel.rows, effectiveYear, effectiveMonth, (row) => ({
          store_id: row.store_id,
          five_percent: row.five_percent,
        }))
      : [];
  // Product lock: equal-weight store mean at reference month (not volume / Final period).
  const currentChain = equalWeightMeanBy(baselineRows, (row) => row.five_percent);
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

  const planForMonitoring = draftPlan;

  const monitoring = useMemo(() => {
    if (!planForMonitoring || !panel) {
      return null;
    }
    const fallback = defaultAsOf(planForMonitoring, panel);
    const year = asOfYear ?? fallback.year;
    const month = asOfMonth ?? fallback.month;
    return buildPlanMonitoringInsights(planForMonitoring, panel, { year, month });
  }, [planForMonitoring, panel, asOfYear, asOfMonth]);

  const canApplyStoreMix =
    draftPlan != null &&
    monitoring != null &&
    monitoring.summary.ahead > 0 &&
    monitoring.summary.behind > 0;

  const captureAnswerUndo = () => captureUndo({ plan: draftPlan, params });

  const handleUndoAnswer = () => {
    const snap = consumeUndo();
    if (!snap) {
      return;
    }
    setParams(snap.params);
    if (snap.plan) {
      patchDraftPlan(snap.plan);
    } else {
      clearAll();
    }
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
    });
    setDraftFromRun(result.plan);
    setActiveAnswer({ kind: 'mix', id: questionId });
    setMixNote(
      t('planner.mix.result', {
        pool: result.poolPp.toFixed(1),
        distributed: result.distributedPp.toFixed(1),
        leftover: result.leftoverPp.toFixed(1),
        delta: result.networkDeltaPp.toFixed(2),
        donors: result.donorIds.length,
        receivers: result.receiverIds.length,
        mode: result.mode,
      }),
    );
    setPendingMixId(null);
  };

  const refreshSlopeSimulation = (opts: {
    networkTarget: number;
    asOf: { year: number; month: number };
    planVersionId?: string | null;
  }) => {
    if (!panel) {
      return;
    }
    const facts = panelToSimulationFacts(panel);
    if (facts.length === 0) {
      return;
    }
    simulationMutation.mutate(
      {
        network_target: opts.networkTarget,
        as_of: opts.asOf,
        planning_year: opts.asOf.year,
        cumulative_start: { year: 2025, month: 1 },
        solver: 'cumulative_slope',
        active_plan_version_id: opts.planVersionId ?? activePlanVersionId,
        facts,
      },
      {
        onSuccess: (response) => {
          // Fresh /simulation has no overrides — drop session Apply stack.
          setImpliedAdjustments([]);
          setSlopeSimulation(response);
          setMaxMonthlyImprove(params.max_monthly_improve);
        },
      },
    );
  };

  const openStoreInspect = (storeId: number) => {
    setMaxMonthlyImprove(params.max_monthly_improve);
    navigate(`/planner/store/${storeId}`);
  };

  const handleRun = () => {
    const goal = commitGoalDrafts();
    const block = plannerRunBlockReason({
      baselineReady,
      storeCount: baselineRows.length,
      currentChain,
      target: goal.target,
      horizon: goal.horizon,
      maxMonthlyImprove: params.max_monthly_improve,
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
        params,
        baseline_rows: baselineRows,
      },
      {
        onSuccess: (response) => {
          const next = response.metrics.five_percent;
          setDraftFromRun(next);
          setMixNote(null);
          setActiveAnswer({ kind: 'manual' });
          if (panel) {
            const asOf = defaultAsOf(next, panel);
            setAsOfYear(asOf.year);
            setAsOfMonth(asOf.month);
            refreshSlopeSimulation({
              networkTarget: goal.target,
              asOf,
            });
          }
        },
        onError: () => {
          setParams(undoSnap.params);
          clearUndo();
        },
      },
    );
  };

  const handleApplyScenarioPack = (packId: ScenarioPackId) => {
    const goal = commitGoalDrafts();
    const block = plannerRunBlockReason({
      baselineReady,
      storeCount: baselineRows.length,
      currentChain,
      target: goal.target,
      horizon: goal.horizon,
      maxMonthlyImprove: params.max_monthly_improve,
      isPending: planMutation.isPending,
    });
    if (block != null || effectiveYear == null || effectiveMonth == null || !panel) {
      return;
    }
    const undoSnap = captureAnswerUndo();
    const pack = getScenarioPack(packId);
    setParams(pack.params);
    setPendingPackId(packId);
    planMutation.mutate(
      {
        reference_year: effectiveYear,
        reference_month: effectiveMonth,
        horizon: goal.horizon,
        target: goal.target,
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
          setMixNote(t('planner.packs.result.applied'));
          setActiveAnswer({ kind: 'pack', id: packId });
          setPendingPackId(null);
          refreshSlopeSimulation({
            networkTarget: goal.target,
            asOf,
          });
        },
        onError: () => {
          setPendingPackId(null);
          setParams(undoSnap.params);
          clearUndo();
        },
      },
    );
  };

  const handleSavePlan = () => {
    if (!panel || !draftPlan || !canSavePlan) {
      return;
    }
    const facts = panelToSimulationFacts(panel);
    if (facts.length === 0 || savePlanMutation.isPending) {
      return;
    }
    const asOf = {
      year: asOfYear ?? draftPlan.chain_trajectory[0]?.year ?? effectiveYear ?? new Date().getFullYear(),
      month: asOfMonth ?? draftPlan.chain_trajectory[0]?.month ?? effectiveMonth ?? 1,
    };
    setSavePlanError(false);
    setSavePlanOk(false);
    savePlanMutation.mutate(
      {
        label: `baseline-${asOf.year}-${String(asOf.month).padStart(2, '0')}`,
        network_target: target,
        as_of: asOf,
        planning_year: asOf.year,
        cumulative_start: { year: 2025, month: 1 },
        solver: 'cumulative_slope',
        facts,
      },
      {
        onSuccess: (version) => {
          setActivePlanVersionId(version.meta.id);
          setSavePlanOk(true);
          acceptDraftAsApproved();
          refreshSlopeSimulation({
            networkTarget: target,
            asOf,
            planVersionId: version.meta.id,
          });
        },
        onError: () => {
          setSavePlanError(true);
        },
      },
    );
  };

  const handleExportCsv = () => {
    if (!draftPlan) {
      return;
    }
    downloadPlanProjectionCsv(draftPlan, 'plan_five_percent_projections.csv');
    acceptDraftAsApproved();
  };

  const canExportExcel = canExportPlanExcel(draftPlan, panel);
  const canSavePlan =
    draftPlan != null && panel != null && panelToSimulationFacts(panel).length > 0;
  const unreachableCount = slopeSimulation?.unreachable.length ?? 0;
  const unreachableStoreIds = useMemo(() => {
    if (!slopeSimulation?.unreachable.length) {
      return undefined;
    }
    return new Set(slopeSimulation.unreachable.map((h) => h.store_id));
  }, [slopeSimulation]);

  const handleExportExcel = () => {
    if (!draftPlan || !panel) {
      return;
    }
    exportExcel({
      canExport: canExportExcel,
      filename: 'sanitization-plan-report.xlsx',
      buildRequest: () =>
        slopeSimulation != null
          ? buildExcelReportRequestFromSimulation(panel, draftPlan, slopeSimulation)
          : buildExcelReportRequest(panel, draftPlan),
    });
  };

  return (
    <PlannerPageShell
      controlsOpen={controlsOpen}
      onToggleControls={() => setControlsOpen((open) => !open)}
      railTestId="controls-rail"
      showCollapsedPlay={showCollapsedPlay}
      collapsedPlay={
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
      }
      rail={
        <>
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
          data-onboarding="planner-levers"
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
            sx={{
              flexShrink: 0,
              pb: 0.5,
              px: `${FIGMA_CONTROLS_PADDING_PX}px`,
              pt: `${FIGMA_CONTROLS_PADDING_PX}px`,
            }}
          />
          <CardContent
            sx={{
              pt: 1,
              px: `${FIGMA_CONTROLS_PADDING_PX}px`,
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              scrollbarGutter: 'stable',
              '&:last-child': { pb: 2 },
            }}
          >
            <Stack spacing={`${FIGMA_CONTROLS_SECTION_GAP_PX}px`}>
              <Stack spacing={1}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ letterSpacing: 0.8 }}
              >
                {t('planner.section.goalTime')}
              </Typography>
              <Stack direction="row" spacing={`${FIGMA_CONTROLS_FIELD_GAP_PX}px`}>
              <TextField
                label={t('planner.target')}
                type="text"
                size="small"
                fullWidth
                value={targetText}
                disabled={!baselineReady}
                onChange={(e) => onTargetChange(e.target.value)}
                onBlur={onTargetBlur}
                inputProps={{
                  inputMode: 'decimal',
                  'aria-label': t('planner.target'),
                  style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                }}
                helperText={t('planner.targetHint')}
              />
              <TextField
                label={t('planner.horizon')}
                type="text"
                size="small"
                fullWidth
                value={horizonText}
                disabled={!baselineReady}
                onChange={(e) => onHorizonChange(e.target.value)}
                onBlur={onHorizonBlur}
                inputProps={{
                  inputMode: 'numeric',
                  'aria-label': t('planner.horizon'),
                  style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                }}
                helperText={t('planner.horizonHint')}
              />
              </Stack>
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
                    resetAnswerState();
                    setAsOfYear(null);
                    setAsOfMonth(null);
                    clearSlopeRuntime();
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
                  sx={{
                    fontFamily: FIGMA_FONT_MONO,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {t('planner.current')}{' '}
                  <strong>{currentChain == null ? '—' : `${currentChain.toFixed(2)}%`}</strong>
                </Typography>
              </Stack>
              </Stack>

              <Box
                sx={{
                  border: 2,
                  borderColor: 'primary.light',
                  borderRadius: 1.5,
                  p: 1.25,
                  bgcolor: 'action.hover',
                }}
                data-testid="scenario-packs-panel"
              >
                <ScenarioPackCards
                  disabled={!canRun || planMutation.isPending}
                  disabledTip={canRun ? '' : runTooltip}
                  pendingId={pendingPackId}
                  pathParams={params}
                  onApply={handleApplyScenarioPack}
                />
              </Box>

              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
                data-testid="store-mix-panel"
              >
                <StoreMixQuestionCards
                  disabled={!canApplyStoreMix || pendingMixId != null}
                  disabledTip={t('planner.mix.disabledTip')}
                  pendingId={pendingMixId}
                  onApply={handleApplyStoreMix}
                />
              </Box>

              {mixNote ? (
                <Alert
                  severity="info"
                  sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.7rem' } }}
                  data-testid="planner-action-note"
                >
                  {mixNote}
                </Alert>
              ) : null}

              <Accordion
                disableGutters
                elevation={0}
                defaultExpanded={false}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                data-testid="planner-advanced-controls"
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 32 }}>
                  <Typography variant="caption" fontWeight={600}>
                    {t('planner.section.advancedControls')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.25}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ letterSpacing: 0.8 }}
                    >
                      {t('planner.section.allocator')}
                    </Typography>
                    <Stack direction="row" spacing={`${FIGMA_CONTROLS_FIELD_GAP_PX}px`}>
                      <TextField
                        label={t('planner.maxMonthly')}
                        type="number"
                        size="small"
                        fullWidth
                        value={params.max_monthly_improve}
                        disabled={!baselineReady}
                        onChange={(e) =>
                          setParams((p) => ({
                            ...p,
                            max_monthly_improve: Number(e.target.value),
                          }))
                        }
                        inputProps={{
                          min: 0.01,
                          step: 0.1,
                          style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                        }}
                      />
                      <TextField
                        label={t('planner.priorityPower')}
                        type="number"
                        size="small"
                        fullWidth
                        value={params.priority_power}
                        disabled={!baselineReady}
                        onChange={(e) =>
                          setParams((p) => ({ ...p, priority_power: Number(e.target.value) }))
                        }
                        inputProps={{
                          min: 0.1,
                          step: 0.1,
                          style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                        }}
                      />
                    </Stack>
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
                              setParams((p) => ({
                                ...p,
                                trajectory_power: Number(e.target.value),
                              }))
                            }
                            inputProps={{
                              min: 0.1,
                              step: 0.1,
                              style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                            }}
                          />
                          <TextField
                            label={t('planner.growthFactor')}
                            type="number"
                            size="small"
                            value={params.growth_factor}
                            disabled={!baselineReady}
                            onChange={(e) =>
                              setParams((p) => ({
                                ...p,
                                growth_factor: Number(e.target.value),
                              }))
                            }
                            inputProps={{
                              min: 0,
                              max: 1,
                              step: 0.1,
                              style: { fontFamily: FIGMA_FONT_MONO, textAlign: 'right' },
                            }}
                          />
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </CardContent>

          {/* Figma §2.3 — bottom-anchored action footer */}
          <Box
            data-testid="planner-controls-footer"
            sx={{
              flexShrink: 0,
              px: `${FIGMA_CONTROLS_PADDING_PX}px`,
              pt: 1.5,
              pb: `${FIGMA_CONTROLS_PADDING_PX}px`,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: `${FIGMA_CONTROLS_FIELD_GAP_PX}px`,
            }}
          >
              <Tooltip title={canRun ? '' : runTooltip}>
                <span>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ height: FIGMA_RUN_BUTTON_HEIGHT_PX }}
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
              <Stack direction="row" spacing={`${FIGMA_CONTROLS_FIELD_GAP_PX}px`}>
                <Tooltip
                  title={
                    canSavePlan ? t('planner.savePlanTip') : t('planner.savePlanDisabledTip')
                  }
                >
                  <span style={{ flex: 1 }}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      fullWidth
                      size="small"
                      sx={{ height: FIGMA_SECONDARY_BUTTON_HEIGHT_PX }}
                      startIcon={
                        savePlanMutation.isPending ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <SaveRoundedIcon />
                        )
                      }
                      disabled={!canSavePlan || savePlanMutation.isPending}
                      onClick={handleSavePlan}
                      data-testid="planner-save-plan"
                    >
                      {t('planner.savePlan')}
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
                      variant="outlined"
                      color="warning"
                      fullWidth
                      size="small"
                      sx={{ height: FIGMA_SECONDARY_BUTTON_HEIGHT_PX }}
                      disabled={!isDirty || approvedPlan == null}
                      onClick={() => {
                        discardDraft();
                        resetAnswerState();
                      }}
                      data-testid="planner-revert-draft"
                    >
                      {t('planner.revertDraft')}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
              <Accordion
                disableGutters
                elevation={0}
                defaultExpanded={false}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                data-testid="planner-export-disclosure"
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 32 }}>
                  <Typography variant="caption" fontWeight={600}>
                    {t('planner.exportDisclosure')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Stack direction="row" spacing={`${FIGMA_CONTROLS_FIELD_GAP_PX}px`}>
                    <Tooltip title={draftPlan ? '' : t('planner.exportDisabledTip')}>
                      <span style={{ flex: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          size="small"
                          sx={{ height: FIGMA_SECONDARY_BUTTON_HEIGHT_PX }}
                          startIcon={<DownloadRoundedIcon />}
                          disabled={!draftPlan}
                          onClick={handleExportCsv}
                        >
                          {t('planner.exportCsv')}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={canExportExcel ? '' : t('planner.exportExcelDisabledTip')}>
                      <span style={{ flex: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          size="small"
                          sx={{ height: FIGMA_SECONDARY_BUTTON_HEIGHT_PX }}
                          startIcon={
                            excelExporting ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <DownloadRoundedIcon />
                            )
                          }
                          disabled={!canExportExcel || excelExporting}
                          onClick={handleExportExcel}
                          data-testid="planner-export-excel"
                        >
                          {t('planner.exportExcel')}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              {savePlanOk ? (
                <Alert severity="success" sx={{ py: 0.5 }} onClose={() => setSavePlanOk(false)}>
                  {t('planner.savePlanSaved')}
                  {activePlanVersionId
                    ? ` · ${activePlanVersionId.slice(0, 8)}…`
                    : ''}
                </Alert>
              ) : null}
              {savePlanError ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {t('planner.savePlanFailed')}
                </Alert>
              ) : null}
              {excelExportError ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {t('planner.exportExcelFailed')}
                </Alert>
              ) : null}

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
          </Box>
        </Card>
        </>
      }
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
            data-testid="planner-analytics"
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              px: { md: 1.5 },
              // Two full-viewport screens: charts, then At-risk — normal scroll.
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarGutter: 'stable',
            }}
          >
            {/* Screen 1 — toolbar + dual Slope charts = one monitor */}
            <Box
              data-testid="planner-screen-charts"
              sx={{
                flex: '0 0 auto',
                height: { md: '100%' },
                minHeight: { xs: 'auto', md: '100%' },
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                pt: { md: 0.75 },
                pb: 1,
                boxSizing: 'border-box',
              }}
            >
              <Box
                data-testid="planner-glance-row"
                role="region"
                aria-label={t('planner.strip.aria')}
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
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
                          sx={{ flexShrink: 0, minWidth: 0, px: 1, height: 28 }}
                        >
                          {t('planner.answer.undo')}
                        </Button>
                      </Tooltip>
                    ) : null}
                  </Stack>
                ) : null}
                <PlannerContextStrip
                  panel={panel}
                  processResult={processResult}
                  baselineReady={baselineReady}
                  draftPlan={draftPlan}
                  horizonMonths={horizon}
                />
                <SimulationSummaryKpis
                  draftPlan={draftPlan}
                  monitoring={monitoring}
                  horizonMonths={horizon}
                />
                {unreachableCount > 0 && slopeSimulation ? (
                  <Tooltip title={t('planner.unreachableChipTip')}>
                    <Chip
                      size="small"
                      color="warning"
                      clickable
                      onClick={() => {
                        const first = slopeSimulation.unreachable[0];
                        atRiskScreenRef.current?.scrollIntoView({
                          block: 'start',
                          behavior: 'smooth',
                        });
                        if (first) {
                          openStoreInspect(first.store_id);
                        }
                      }}
                      sx={{ flexShrink: 0 }}
                      label={t('planner.unreachableChip', { count: unreachableCount })}
                      data-testid="planner-unreachable-chip"
                    />
                  </Tooltip>
                ) : null}
                <Button
                  size="small"
                  variant="outlined"
                  data-testid="planner-inspect-store"
                  disabled={draftPlan.projections.length === 0}
                  onClick={() => {
                    const behindId = monitoring?.stores.find(
                      (row) => row.signal === 'behind_plan',
                    )?.store_id;
                    const storeId =
                      behindId ??
                      slopeSimulation?.unreachable[0]?.store_id ??
                      draftPlan.projections[0]?.store_id;
                    if (storeId != null) {
                      openStoreInspect(storeId);
                    }
                  }}
                  sx={{
                    ml: 'auto',
                    flexShrink: 0,
                    height: 28,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('planner.inspect.openStore')}
                </Button>
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
                  data-testid="planner-slope-chart-stack"
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${NETWORK_SLOPE_CHART_GAP_PX}px`,
                    width: '100%',
                  }}
                >
                  <Card
                    variant="outlined"
                    data-onboarding="planner-hero"
                    data-testid="planner-slope-cumulative"
                    data-density="viewport"
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      borderWidth: 2,
                      borderColor: 'primary.light',
                      overflow: 'hidden',
                    }}
                  >
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
                      {slopeLayers ? (
                        <SlopeCumulativePanel layers={slopeLayers} />
                      ) : (
                        <Stack
                          spacing={0.5}
                          sx={{ flex: 1, px: 0.5 }}
                          data-testid="slope-cumulative-placeholder"
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('planner.slope.panelCumulative')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ m: 'auto' }}>
                            {panel ? t('planner.heroNeedSimulation') : t('planner.heroNeedPanel')}
                          </Typography>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>

                  <Card
                    variant="outlined"
                    data-testid="planner-slope-monthly"
                    data-density="viewport"
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      width: '100%',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
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
                      {slopeLayers ? (
                        <SlopeMonthlyPanel layers={slopeLayers} />
                      ) : (
                        <Stack
                          spacing={0.5}
                          sx={{ flex: 1, px: 0.5 }}
                          data-testid="slope-monthly-placeholder"
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('planner.slope.panelMonthly')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ m: 'auto' }}>
                            {panel ? t('planner.heroNeedSimulation') : t('planner.heroNeedPanel')}
                          </Typography>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>

            {/* Screen 2 — At-risk panels = second full monitor */}
            {panel && monitoring && planForMonitoring ? (
              <Box
                ref={atRiskScreenRef}
                data-testid="planner-screen-atrisk"
                sx={{
                  flex: '0 0 auto',
                  height: { md: '100%' },
                  minHeight: { xs: 360, md: '100%' },
                  boxSizing: 'border-box',
                  pb: 1,
                }}
              >
                <AtRiskPanelsSection
                  testId="planner-at-risk-sheet"
                  onboardingId="planner-at-risk"
                  plan={planForMonitoring}
                  approvedPlan={approvedPlan}
                  baselineRows={baselineRows}
                  panel={panel}
                  insights={monitoring}
                  asOfOptions={planForMonitoring.chain_trajectory.map((m) => ({
                    year: m.year,
                    month: m.month,
                  }))}
                  onAsOfChange={(year, month) => {
                    setAsOfYear(year);
                    setAsOfMonth(month);
                  }}
                  onInspect={openStoreInspect}
                  unreachableStoreIds={unreachableStoreIds}
                />
              </Box>
            ) : null}
          </Box>
        ) : (
          <Box
            data-testid="planner-analytics-empty"
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: `${PLANNER_ANALYTICS_SECTION_GAP_PX}px`,
              px: { md: `${PLANNER_ANALYTICS_PADDING_PX}px` },
              pt: { md: `${PLANNER_ANALYTICS_PADDING_PX}px` },
              overflow: 'auto',
              pb: `${PLANNER_ANALYTICS_PADDING_PX}px`,
            }}
          >
            <Alert severity="info" sx={{ flexShrink: 0 }}>
              {baselineReady ? t('planner.emptyReady') : t('planner.emptyWaiting')}
            </Alert>
            <Box
              data-testid="planner-slope-chart-stack"
              sx={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: `${NETWORK_SLOPE_CHART_GAP_PX}px`,
                width: '100%',
              }}
            >
              <Card
                variant="outlined"
                data-onboarding="planner-hero"
                data-testid="planner-slope-cumulative"
                sx={{
                  flex: '0 0 auto',
                  height: NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
                  borderWidth: 2,
                  borderColor: 'primary.light',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack spacing={0.5} sx={{ flex: 1 }} data-testid="slope-cumulative-placeholder">
                    <Typography variant="caption" color="text.secondary">
                      {t('planner.slope.panelCumulative')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ m: 'auto' }}>
                      {panel ? t('planner.heroNeedSimulation') : t('planner.heroNeedPanel')}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
              <Card
                variant="outlined"
                data-testid="planner-slope-monthly"
                sx={{
                  flex: '0 0 auto',
                  height: NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack spacing={0.5} sx={{ flex: 1 }} data-testid="slope-monthly-placeholder">
                    <Typography variant="caption" color="text.secondary">
                      {t('planner.slope.panelMonthly')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ m: 'auto' }}>
                      {panel ? t('planner.heroNeedSimulation') : t('planner.heroNeedPanel')}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
    </PlannerPageShell>
  );
}
