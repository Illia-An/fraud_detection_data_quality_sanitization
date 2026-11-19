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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  useAdjustSimulation,
  usePlan,
  useRunSimulation,
  useSavePlanVersion,
} from '../api/hooks';
import { AtRiskDeltaTable } from '../components/planner/AtRiskDeltaTable';
import { activeAnswerLabelKey } from '../components/planner/activeAnswer';
import {
  buildNetworkCumulativeSlopeLayers,
  getStoreBoostGlance,
} from '../components/planner/cumulativeSlopeLayers';
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
  NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX,
  NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
  NETWORK_SLOPE_CHART_GAP_PX,
  PLANNER_ANALYTICS_PADDING_PX,
  PLANNER_ANALYTICS_SECTION_GAP_PX,
  SLOPE_STATUS_SLOT_MIN_HEIGHT_PX,
} from '../components/planner/slopeHeroShared';
import {
  mergeImpliedAdjustment,
  type ImpliedAdjustment,
} from '../components/planner/impliedAdjustments';
import { panelToSimulationFacts } from '../components/planner/panelToSimulationFacts';
import { PlannerContextStrip } from '../components/planner/PlannerContextStrip';
import type { SimulationResponse, UnreachableHint } from '../schemas/cumulativePlan';
import {
  PLANNER_RUN_BLOCK_MESSAGE_KEYS,
  plannerRunBlockReason,
} from '../components/planner/plannerRunGuards';
import { useT } from '../i18n';
import { ScenarioPackCards } from '../components/planner/ScenarioPackCards';
import { SimulationSummaryKpis } from '../components/planner/SimulationSummaryKpis';
import { StoreAuditDrawer } from '../components/planner/StoreAuditDrawer';
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
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { PLANNER_PREFERRED_REFERENCE } from '../components/planner/plannerShell';
import { PlannerAtRiskDock } from '../components/planner/PlannerAtRiskDock';
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
import { useSlopePlanDraft } from '../components/planner/useSlopePlanDraft';
import {
  overlayDirectedPlanWithSlopePackage,
  storeMonthlyTargetsFromPackage,
} from '../components/planner/slopePlanRecompute';
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
  const activePlanVersionId = usePlannerScenarioStore((s) => s.activePlanVersionId);
  const setActivePlanVersionId = usePlannerScenarioStore((s) => s.setActivePlanVersionId);

  const simulationMutation = useRunSimulation();
  const adjustSimulationMutation = useAdjustSimulation();
  const savePlanMutation = useSavePlanVersion();

  const [controlsOpen, setControlsOpen] = useControlsRailOpen(CONTROLS_RAIL_ROUTE.planner);
  const showCollapsedPlay = useCollapsedPlayReveal(controlsOpen);
  /** Figma overview: exception disclosure collapsed; expand compactifies charts. */
  const [atRiskExpanded, setAtRiskExpanded] = useState(false);
  const { excelExporting, excelExportError, exportExcel } = usePlannerExcelExport();
  const [slopeSimulation, setSlopeSimulation] = useState<SimulationResponse | null>(null);
  const baselineSlopeLayers = useMemo(
    () => (slopeSimulation ? buildNetworkCumulativeSlopeLayers(slopeSimulation) : null),
    [slopeSimulation],
  );
  const slopePlanDraft = useSlopePlanDraft(baselineSlopeLayers, slopeSimulation);
  /** Session overrides from Apply suggestion — sent together on each /simulation/adjust. */
  const [impliedAdjustments, setImpliedAdjustments] = useState<ImpliedAdjustment[]>([]);
  const [savePlanError, setSavePlanError] = useState(false);
  const [savePlanOk, setSavePlanOk] = useState(false);
  const [adjustSuggestionError, setAdjustSuggestionError] = useState(false);

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

  /** At-risk / monitoring follow Slope allocate package when pins are committed. */
  const planForMonitoring = useMemo(() => {
    if (!draftPlan) return null;
    if (slopePlanDraft.lastGood?.byStore && baselineSlopeLayers) {
      return overlayDirectedPlanWithSlopePackage(
        draftPlan,
        slopePlanDraft.lastGood,
        baselineSlopeLayers.labels,
      );
    }
    return draftPlan;
  }, [draftPlan, slopePlanDraft.lastGood, baselineSlopeLayers]);

  const monitoring = useMemo(() => {
    if (!planForMonitoring || !panel) {
      return null;
    }
    const fallback = defaultAsOf(planForMonitoring, panel);
    const year = asOfYear ?? fallback.year;
    const month = asOfMonth ?? fallback.month;
    return buildPlanMonitoringInsights(planForMonitoring, panel, { year, month });
  }, [planForMonitoring, panel, asOfYear, asOfMonth]);

  const atRiskPending =
    slopePlanDraft.status === 'previewing' || slopePlanDraft.status === 'allocating';

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
        },
      },
    );
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
          slopePlanDraft.resetPins();
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

  const buildSimulationRequestBase = (opts?: {
    networkTarget?: number;
    asOf?: { year: number; month: number };
    planVersionId?: string | null;
  }) => {
    if (!panel) {
      return null;
    }
    const facts = panelToSimulationFacts(panel);
    if (facts.length === 0) {
      return null;
    }
    const asOf = opts?.asOf ?? {
      year:
        asOfYear ??
        draftPlan?.chain_trajectory[0]?.year ??
        effectiveYear ??
        new Date().getFullYear(),
      month:
        asOfMonth ??
        draftPlan?.chain_trajectory[0]?.month ??
        effectiveMonth ??
        1,
    };
    return {
      network_target: opts?.networkTarget ?? target,
      as_of: asOf,
      planning_year: asOf.year,
      cumulative_start: { year: 2025, month: 1 } as const,
      solver: 'cumulative_slope' as const,
      active_plan_version_id: opts?.planVersionId ?? activePlanVersionId,
      facts,
    };
  };

  const handleApplyUnreachableSuggestion = (hint: UnreachableHint) => {
    const base = buildSimulationRequestBase();
    if (base == null || adjustSimulationMutation.isPending) {
      return;
    }
    setAdjustSuggestionError(false);
    const nextAdjustments = mergeImpliedAdjustment(impliedAdjustments, {
      store_id: hint.store_id,
      new_implied_target: hint.suggested_implied_target,
    });
    adjustSimulationMutation.mutate(
      {
        ...base,
        adjustments: nextAdjustments,
      },
      {
        onSuccess: (response) => {
          setImpliedAdjustments(nextAdjustments);
          setSlopeSimulation(response);
        },
        onError: () => {
          setAdjustSuggestionError(true);
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
    let storeMonthlyTargets:
      | { store_id: number; monthly_target: { year: number; month: number; score: number }[] }[]
      | undefined;
    if (slopePlanDraft.dirty && slopePlanDraft.lastGood && slopeLayers) {
      try {
        storeMonthlyTargets = storeMonthlyTargetsFromPackage(
          slopePlanDraft.lastGood,
          slopeLayers.labels,
          asOf.year,
        );
      } catch {
        setSavePlanError(true);
        return;
      }
    }
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
        ...(storeMonthlyTargets != null && storeMonthlyTargets.length > 0
          ? { store_monthly_targets: storeMonthlyTargets }
          : {}),
      },
      {
        onSuccess: (version) => {
          setActivePlanVersionId(version.meta.id);
          setSavePlanOk(true);
          acceptDraftAsApproved();
          slopePlanDraft.resetPins();
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
  const slopeLayers = slopePlanDraft.displayLayers;
  const getPlanDragGeneration = useCallback(
    () => slopePlanDraft.generation,
    [slopePlanDraft.generation],
  );
  const canSavePlan =
    draftPlan != null &&
    panel != null &&
    panelToSimulationFacts(panel).length > 0 &&
    slopePlanDraft.status !== 'previewing' &&
    slopePlanDraft.status !== 'allocating';

  // Spec L4: UI target change cancels unfinished pin draft (sim target updates on Run).
  useEffect(() => {
    slopePlanDraft.resetPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when target number changes
  }, [target]);
  const unreachableCount = slopeSimulation?.unreachable.length ?? 0;
  const unreachableStoreIds = useMemo(() => {
    if (!slopeSimulation?.unreachable.length) {
      return undefined;
    }
    return new Set(slopeSimulation.unreachable.map((h) => h.store_id));
  }, [slopeSimulation]);
  const selectedUnreachableHint = useMemo(() => {
    if (selectedStoreId == null || !slopeSimulation?.unreachable.length) {
      return null;
    }
    return (
      slopeSimulation.unreachable.find((h) => h.store_id === selectedStoreId) ?? null
    );
  }, [selectedStoreId, slopeSimulation]);
  const selectedBoostGlance = useMemo(() => {
    if (selectedStoreId == null || slopeSimulation == null) {
      return null;
    }
    return getStoreBoostGlance(slopeSimulation, selectedStoreId);
  }, [selectedStoreId, slopeSimulation]);

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
                    setSlopeSimulation(null);
                    setImpliedAdjustments([]);
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
                    slopePlanDraft.dirty
                      ? t('planner.savePlanWithPinsTip')
                      : canSavePlan
                        ? t('planner.savePlanTip')
                        : t('planner.savePlanDisabledTip')
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
              {adjustSuggestionError ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  {t('planner.unreachable.applyFailed')}
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
              gap: `${PLANNER_ANALYTICS_SECTION_GAP_PX}px`,
              px: { md: `${PLANNER_ANALYTICS_PADDING_PX}px` },
              pt: { md: `${PLANNER_ANALYTICS_PADDING_PX}px` },
              overflow: { md: 'hidden' },
            }}
          >
            {/* Figma §3.1 — run/provenance row */}
            <Box
              data-testid="planner-glance-row"
              role="region"
              aria-label={t('planner.strip.aria')}
              sx={{
                flexShrink: 0,
                display: 'flex',
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 1,
                width: '100%',
                minHeight: 28,
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
            </Box>

            {/* Figma §3.2 — dedicated KPI strip */}
            <SimulationSummaryKpis
              draftPlan={draftPlan}
              monitoring={monitoring}
              horizonMonths={horizon}
            />

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
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${PLANNER_ANALYTICS_SECTION_GAP_PX}px`,
                  overflow: 'auto',
                  scrollbarGutter: 'stable',
                  pb: `${PLANNER_ANALYTICS_PADDING_PX}px`,
                }}
              >
                {unreachableCount > 0 && slopeSimulation ? (
                  <Tooltip title={t('planner.unreachableChipTip')}>
                    <Chip
                      size="small"
                      color="warning"
                      clickable
                      onClick={() => {
                        const first = slopeSimulation.unreachable[0];
                        if (first) {
                          setAtRiskExpanded(true);
                          selectStore(first.store_id);
                        }
                      }}
                      sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
                      label={t('planner.unreachableChip', { count: unreachableCount })}
                      data-testid="planner-unreachable-chip"
                    />
                  </Tooltip>
                ) : null}
                {panel && slopeLayers ? (
                  <>
                    {/* Fixed slot (one alert): mount/unmount must not shift charts. */}
                    <Box
                      data-testid="slope-plan-status-slot"
                      sx={{
                        flexShrink: 0,
                        minHeight: SLOPE_STATUS_SLOT_MIN_HEIGHT_PX,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {slopePlanDraft.error ? (
                        <Alert
                          severity="warning"
                          sx={{ py: 0.25 }}
                          data-testid="slope-plan-error-banner"
                        >
                          {t('planner.slope.pinError', {
                            code: slopePlanDraft.error.code,
                            reason: slopePlanDraft.error.reason,
                          })}
                        </Alert>
                      ) : slopePlanDraft.status === 'allocating' ? (
                        <Alert
                          severity="info"
                          sx={{ py: 0.25 }}
                          icon={<CircularProgress size={16} />}
                          data-testid="slope-plan-allocating-banner"
                        >
                          {t('planner.slope.allocating')}
                        </Alert>
                      ) : slopePlanDraft.dirty ? (
                        <Alert
                          severity="info"
                          sx={{ py: 0.25 }}
                          action={
                            <Button
                              color="inherit"
                              size="small"
                              onClick={() => slopePlanDraft.resetPins()}
                              data-testid="slope-plan-reset"
                            >
                              {t('planner.slope.resetPins')}
                            </Button>
                          }
                          data-testid="slope-plan-dirty-banner"
                        >
                          {t('planner.slope.pinsDirty')}
                        </Alert>
                      ) : null}
                    </Box>

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
                      data-density={atRiskExpanded ? 'compact' : 'overview'}
                      sx={{
                        flex: '0 0 auto',
                        height: atRiskExpanded
                          ? NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX
                          : NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
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
                        <SlopeCumulativePanel
                          layers={slopeLayers}
                          planDragEnabled
                          layoutFrozen={
                            slopePlanDraft.status === 'previewing' ||
                            slopePlanDraft.status === 'allocating'
                          }
                          onPlanDragPreview={(monthIndex, value) =>
                            slopePlanDraft.previewDrag('cumulative', monthIndex, value)
                          }
                          onPlanDragCommit={(monthIndex, value) =>
                            slopePlanDraft.endDrag('cumulative', monthIndex, value)
                          }
                          onPlanDragCancel={() => slopePlanDraft.cancelDrag()}
                          getPlanDragGeneration={getPlanDragGeneration}
                        />
                      </CardContent>
                    </Card>

                    <Card
                      variant="outlined"
                      data-testid="planner-slope-monthly"
                      data-density={atRiskExpanded ? 'compact' : 'overview'}
                      sx={{
                        flex: '0 0 auto',
                        height: atRiskExpanded
                          ? NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX
                          : NETWORK_SLOPE_CARD_HEIGHT_OVERVIEW_PX,
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
                        <SlopeMonthlyPanel
                          layers={slopeLayers}
                          planDragEnabled
                          layoutFrozen={
                            slopePlanDraft.status === 'previewing' ||
                            slopePlanDraft.status === 'allocating'
                          }
                          onPlanDragPreview={(monthIndex, value) =>
                            slopePlanDraft.previewDrag('monthly', monthIndex, value)
                          }
                          onPlanDragCommit={(monthIndex, value) =>
                            slopePlanDraft.endDrag('monthly', monthIndex, value)
                          }
                          onPlanDragCancel={() => slopePlanDraft.cancelDrag()}
                          getPlanDragGeneration={getPlanDragGeneration}
                        />
                      </CardContent>
                    </Card>
                    </Box>
                  </>
                ) : (
                  <Card
                    variant="outlined"
                    data-onboarding="planner-hero"
                    sx={{
                      flex: 1,
                      minHeight: 240,
                      borderWidth: 2,
                      borderColor: 'primary.light',
                    }}
                  >
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        {panel ? t('planner.heroNeedSimulation') : t('planner.heroNeedPanel')}
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                {panel && monitoring && planForMonitoring ? (
                  <PlannerAtRiskDock
                    placement="flow"
                    testId="planner-at-risk-sheet"
                    onboardingId="planner-at-risk"
                    expanded={atRiskExpanded}
                    onExpandedChange={setAtRiskExpanded}
                    behindCount={monitoring.summary.behind}
                    aheadCount={monitoring.summary.ahead}
                    stableScrollbar
                  >
                    {atRiskPending ? (
                      <Alert
                        severity="info"
                        sx={{ py: 0.25, mb: 1 }}
                        data-testid="slope-at-risk-pending-banner"
                      >
                        {t('planner.slope.atRiskPending')}
                      </Alert>
                    ) : null}
                    <AtRiskDeltaTable
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
                      onInspect={(storeId) => selectStore(storeId)}
                      unreachableStoreIds={unreachableStoreIds}
                    />
                  </PlannerAtRiskDock>
                ) : null}
              </Box>
            </Box>

            {panel && monitoring && planForMonitoring && selectedStoreId != null && (
              <StoreAuditDrawer
                open
                storeId={selectedStoreId}
                plan={planForMonitoring}
                panel={panel}
                insights={monitoring}
                processResult={processResult}
                maxMonthlyImprove={params.max_monthly_improve}
                baselineRows={baselineRows}
                onClose={() => selectStore(null)}
                onStoreChange={(id) => selectStore(id)}
                onApplyPlan={(next) => patchDraftPlan(next)}
                unreachableHint={selectedUnreachableHint}
                onApplyUnreachableSuggestion={
                  selectedUnreachableHint
                    ? () => handleApplyUnreachableSuggestion(selectedUnreachableHint)
                    : undefined
                }
                unreachableApplyPending={adjustSimulationMutation.isPending}
                boostGlance={selectedBoostGlance}
                slopeSimulation={slopeSimulation}
                slopeStorePlanOverride={
                  selectedStoreId != null
                    ? slopePlanDraft.byStore?.get(selectedStoreId) ?? null
                    : null
                }
              />
            )}
          </Box>
        ) : (
          <Alert severity="info" sx={{ flexShrink: 0 }}>
            {baselineReady ? t('planner.emptyReady') : t('planner.emptyWaiting')}
          </Alert>
        )}
    </PlannerPageShell>
  );
}
