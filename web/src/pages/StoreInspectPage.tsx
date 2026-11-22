import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAdjustSimulation } from '../api/hooks';
import {
  buildInspectSlopeAlign,
  buildStoreCumulativeSlopeLayers,
  getStoreBoostGlance,
} from '../components/planner/cumulativeSlopeLayers';
import { mergeImpliedAdjustment } from '../components/planner/impliedAdjustments';
import { InspectStoreGlance } from '../components/planner/InspectStoreGlance';
import { panelToSimulationFacts } from '../components/planner/panelToSimulationFacts';
import { baselineRowsAtReference } from '../components/planner/plannerBaseline';
import { NETWORK_SLOPE_CHART_GAP_PX } from '../components/planner/slopeHeroShared';
import { SlopeCumulativePanel } from '../components/planner/SlopeCumulativePanel';
import { SlopeMonthlyPanel } from '../components/planner/SlopeMonthlyPanel';
import { StoreAuditSandboxPanel } from '../components/planner/storeAudit/StoreAuditSandboxPanel';
import { UnreachableRecommendationCard } from '../components/planner/UnreachableRecommendationCard';
import { useStoreAuditSandbox } from '../components/planner/useStoreAuditSandbox';
import { useT } from '../i18n';
import type { MetricScorePanel } from '../schemas/metricScore';
import type { FivePercentPlan } from '../schemas/plan';
import {
  buildPlanMonitoringInsights,
  defaultAsOf,
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  type PlanMonitoringInsights,
} from '../schemas/planMonitoring';
import { buildSanitizedPanelFromProcess } from '../schemas/sanitizedPanel';
import { usePlannerRuntimeStore } from '../store/plannerRuntimeStore';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';

/**
 * Full-page store Inspect: glance + dual Slope charts; Estimate vs actual opens in a dialog.
 */
export function StoreInspectPage() {
  const { storeId: storeIdParam } = useParams();
  const storeId = Number(storeIdParam);

  const draftPlan = usePlannerScenarioStore((s) => s.draftPlan);
  const processResult = useUiStore((s) => s.processResult);

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

  const monitoring = useMemo(() => {
    if (!draftPlan || !panel) {
      return null;
    }
    try {
      return buildPlanMonitoringInsights(draftPlan, panel, defaultAsOf(draftPlan, panel));
    } catch {
      return null;
    }
  }, [draftPlan, panel]);

  if (!Number.isFinite(storeId) || storeId <= 0 || !draftPlan) {
    return <Navigate to="/planner" replace />;
  }

  if (!panel || !monitoring) {
    return <Navigate to="/planner" replace />;
  }

  return (
    <StoreInspectPageBody storeId={storeId} plan={draftPlan} panel={panel} insights={monitoring} />
  );
}

function StoreInspectPageBody({
  storeId,
  plan,
  panel,
  insights,
}: {
  storeId: number;
  plan: FivePercentPlan;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
}) {
  const t = useT();
  const navigate = useNavigate();
  const patchDraftPlan = usePlannerScenarioStore((s) => s.patchDraftPlan);
  const activePlanVersionId = usePlannerScenarioStore((s) => s.activePlanVersionId);
  const slopeSimulation = usePlannerRuntimeStore((s) => s.slopeSimulation);
  const setSlopeSimulation = usePlannerRuntimeStore((s) => s.setSlopeSimulation);
  const maxMonthlyImprove = usePlannerRuntimeStore((s) => s.maxMonthlyImprove);
  const impliedAdjustments = usePlannerRuntimeStore((s) => s.impliedAdjustments);
  const setImpliedAdjustments = usePlannerRuntimeStore((s) => s.setImpliedAdjustments);
  const adjustSimulationMutation = useAdjustSimulation();
  const [adjustSuggestionError, setAdjustSuggestionError] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const baselineRows = useMemo(() => {
    const ref = plan.chain_trajectory[0];
    if (!ref) {
      return [];
    }
    return baselineRowsAtReference(panel.rows, ref.year, ref.month, (row) => ({
      store_id: row.store_id,
      five_percent: row.five_percent,
    }));
  }, [panel, plan]);

  const storeIds = useMemo(
    () => [...new Set(plan.projections.map((p) => p.store_id))].sort((a, b) => a - b),
    [plan.projections],
  );

  const slopeLayers = useMemo(
    () =>
      slopeSimulation != null ? buildStoreCumulativeSlopeLayers(slopeSimulation, storeId) : null,
    [slopeSimulation, storeId],
  );

  const slopeAlign = useMemo(
    () => (slopeLayers != null ? buildInspectSlopeAlign(slopeLayers) : null),
    [slopeLayers],
  );

  const boostGlance = useMemo(
    () => (slopeSimulation != null ? getStoreBoostGlance(slopeSimulation, storeId) : null),
    [slopeSimulation, storeId],
  );

  const unreachableHint = useMemo(() => {
    if (!slopeSimulation?.unreachable.length) {
      return null;
    }
    return slopeSimulation.unreachable.find((h) => h.store_id === storeId) ?? null;
  }, [slopeSimulation, storeId]);

  const monitorRow = insights.stores.find((s) => s.store_id === storeId);

  const sandbox = useStoreAuditSandbox({
    storeId,
    plan,
    panel,
    insights,
    maxMonthlyImprove,
    onApplyPlan: (next) => patchDraftPlan(next),
    active: true,
  });

  const openSandbox = () => {
    sandbox.setSandboxExpanded(true);
    setSandboxOpen(true);
  };

  const handleApplyUnreachableSuggestion = () => {
    if (unreachableHint == null || adjustSimulationMutation.isPending) {
      return;
    }
    const facts = panelToSimulationFacts(panel);
    if (facts.length === 0) {
      return;
    }
    const asOf = {
      year: insights.as_of_year,
      month: insights.as_of_month,
    };
    const nextAdjustments = mergeImpliedAdjustment(impliedAdjustments, {
      store_id: unreachableHint.store_id,
      new_implied_target: unreachableHint.suggested_implied_target,
    });
    setAdjustSuggestionError(false);
    adjustSimulationMutation.mutate(
      {
        network_target: plan.target,
        as_of: asOf,
        planning_year: asOf.year,
        cumulative_start: { year: 2025, month: 1 },
        solver: 'cumulative_slope',
        active_plan_version_id: activePlanVersionId,
        facts,
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

  return (
    <Box
      data-testid="store-inspect-page"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        px: { md: 1.5 },
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarGutter: 'stable',
      }}
    >
      <Box
        data-testid="store-inspect-screen-charts"
        sx={{
          flex: 1,
          minHeight: 0,
          height: { md: '100%' },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          pt: { md: 0.75 },
          pb: 1,
          boxSizing: 'border-box',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ md: 'center' }}
          sx={{ flexShrink: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }} flexWrap="wrap" useFlexGap>
            <Button
              component={RouterLink}
              to="/planner"
              size="small"
              startIcon={<ArrowBackIcon />}
              data-testid="store-inspect-back"
            >
              {t('planner.storePage.back')}
            </Button>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('planner.inspect.titlePrefix')}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={storeId}
                onChange={(event) => navigate(`/planner/store/${event.target.value}`)}
                inputProps={{
                  'aria-label': t('planner.inspect.storeSelect'),
                  'data-testid': 'inspect-store-select',
                }}
                data-testid="store-inspect-store-select"
              >
                {storeIds.map((id) => (
                  <MenuItem key={id} value={id}>
                    {t('planner.storePage.title', { id })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {monitorRow ? (
              <Chip
                size="small"
                label={SIGNAL_LABELS[monitorRow.signal]}
                sx={{
                  bgcolor: SIGNAL_COLORS[monitorRow.signal],
                  color: '#fff',
                  height: 22,
                  fontSize: '0.7rem',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ) : null}
            <Tooltip title={t('planner.inspect.sandboxWarn')} arrow>
              <IconButton
                size="small"
                aria-label={t('planner.inspect.sandboxWarn')}
                sx={{ p: 0.4, color: 'warning.main' }}
                data-testid="inspect-sandbox-warn"
              >
                <WarningAmberIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <InspectStoreGlance
              plan={plan}
              insights={insights}
              storeId={storeId}
              baselineRows={baselineRows}
              draftLast={sandbox.appliedDraft}
              slopeAlign={slopeAlign}
            />
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TuneIcon />}
            onClick={openSandbox}
            sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', md: 'center' } }}
            data-testid="inspect-open-sandbox"
          >
            {t('planner.inspect.estimateTitle')}
          </Button>
        </Stack>

        {boostGlance != null ? (
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            data-testid="inspect-boost-glance"
            sx={{ flexShrink: 0 }}
          >
            <Chip
              size="small"
              variant="outlined"
              color="info"
              label={t('planner.inspect.boostGap', {
                gap: boostGlance.gapToMean.toFixed(1),
              })}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <Chip
              size="small"
              variant="outlined"
              color="info"
              label={t('planner.inspect.boostSlope', {
                slope: boostGlance.slope.toFixed(2),
              })}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </Stack>
        ) : null}

        {adjustSuggestionError ? (
          <Alert severity="error" sx={{ flexShrink: 0 }} onClose={() => setAdjustSuggestionError(false)}>
            {t('planner.unreachable.applyFailed')}
          </Alert>
        ) : null}
        {unreachableHint != null ? (
          <UnreachableRecommendationCard
            hint={unreachableHint}
            onApply={handleApplyUnreachableSuggestion}
            applyPending={adjustSimulationMutation.isPending}
          />
        ) : null}

        {!slopeLayers ? (
          <Alert severity="info" sx={{ flexShrink: 0 }} data-testid="store-inspect-need-sim">
            {t('planner.storePage.needSimulation')}
          </Alert>
        ) : (
          <Box
            data-testid="store-inspect-chart-stack"
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: `${NETWORK_SLOPE_CHART_GAP_PX}px`,
            }}
          >
            <Card
              variant="outlined"
              data-testid="store-inspect-slope-cumulative"
              sx={{
                flex: 1,
                minHeight: 0,
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
                <SlopeCumulativePanel layers={slopeLayers} />
              </CardContent>
            </Card>
            <Card
              variant="outlined"
              data-testid="store-inspect-slope-monthly"
              sx={{
                flex: 1,
                minHeight: 0,
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
                <SlopeMonthlyPanel layers={slopeLayers} />
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      <Dialog
        open={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="inspect-sandbox-dialog-title"
        data-testid="inspect-sandbox-dialog"
      >
        <DialogTitle
          id="inspect-sandbox-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 1.25,
            pr: 1,
          }}
        >
          <Typography component="span" variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            {t('planner.inspect.estimateTitle')}
          </Typography>
          <Tooltip title={t('planner.inspect.sandboxWarn')} arrow>
            <IconButton
              size="small"
              aria-label={t('planner.inspect.sandboxWarn')}
              sx={{ color: 'warning.main' }}
              data-testid="inspect-sandbox-dialog-warn"
            >
              <WarningAmberIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton
            aria-label={t('planner.inspect.done')}
            onClick={() => setSandboxOpen(false)}
            size="small"
            data-testid="inspect-sandbox-dialog-close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 2, py: 1.5 }}>
          <StoreAuditSandboxPanel
            layout="inline"
            storeId={storeId}
            scoreDigits={sandbox.scoreDigits}
            sandboxExpanded={sandbox.sandboxExpanded}
            onSandboxExpandedChange={sandbox.setSandboxExpanded}
            preview={sandbox.preview}
            originalLast={sandbox.originalLast}
            displayTable={sandbox.displayTable}
            editableCol={sandbox.editableCol}
            inputValue={sandbox.inputValue}
            onInputValueChange={sandbox.setInputValue}
            error={sandbox.error}
            bounds={sandbox.bounds}
            lastPeriod={sandbox.lastPeriod}
            appliedDraft={sandbox.appliedDraft}
            onRecalculate={sandbox.handleRecalculate}
            onApply={sandbox.handleApply}
            onReset={sandbox.handleReset}
            poolDialogOpen={sandbox.poolDialogOpen}
            onPoolDialogOpenChange={sandbox.setPoolDialogOpen}
            applyToastOpen={sandbox.applyToastOpen}
            onApplyToastClose={() => sandbox.setApplyToastOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
