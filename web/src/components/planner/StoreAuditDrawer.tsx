import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../i18n';
import type { ProcessResponse } from '../../schemas/api';
import { sortPipelineSteps } from '../../schemas/api';
import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import {
  applyDraftLastMonthToTable,
  buildStorePlanActualDifferenceTable,
  lastEstimateIndex,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights, StoreMonitorRow } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import {
  applySandboxEvenSplitToPlan,
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
  type SandboxEvenSplitPreview,
} from '../../schemas/sandboxPreview';
import type { SimulationResponse, UnreachableHint } from '../../schemas/cumulativePlan';
import {
  buildInspectSlopeAlign,
  buildStoreCumulativeSlopeLayers,
  type StoreBoostGlance,
} from './cumulativeSlopeLayers';
import { InspectStoreGlance } from './InspectStoreGlance';
import { UnreachableRecommendationCard } from './UnreachableRecommendationCard';
import type { StoreBaselineRow } from './atRiskRowMetrics';
import { StoreAuditDialogTitle } from './storeAudit/StoreAuditDialogTitle';
import { StoreAuditHero } from './storeAudit/StoreAuditHero';
import { StoreAuditSandboxPanel } from './storeAudit/StoreAuditSandboxPanel';
import {
  formatScore as formatScoreValue,
  scoreDisplayForUnit,
} from './storeAudit/storeAuditFormat';
import { INSPECT_DIALOG_PAPER_MAX_PX } from './storeAudit/storeAuditLayout';

type InspectPanel = MetricScorePanel & {
  echo_config?: SanitizedPanel['echo_config'];
};

interface StoreAuditDrawerProps<T extends DirectedPlan = DirectedPlan> {
  open: boolean;
  storeId: number;
  plan: T;
  panel: InspectPanel;
  insights: PlanMonitoringInsights;
  processResult: ProcessResponse | null;
  maxMonthlyImprove: number;
  /** Reference-month baseline scores (Baseline → End). */
  baselineRows?: StoreBaselineRow[];
  onClose: () => void;
  /** Switch Inspected store without closing the dialog. */
  onStoreChange: (storeId: number) => void;
  /** Commit even-split into session draftPlan (Hero updates; Inspect stays open). */
  onApplyPlan: (plan: T) => void;
  /** SPEC-P001 unreachable hint for this store (from live simulation). */
  unreachableHint?: UnreachableHint | null;
  /** Apply suggested implied target via /simulation/adjust. */
  onApplyUnreachableSuggestion?: () => void;
  unreachableApplyPending?: boolean;
  /** Boost / slope glance from cumulative_slope store curves. */
  boostGlance?: StoreBoostGlance | null;
  /** Live Slope simulation — when present, Inspect uses dual-panel Slope chart. */
  slopeSimulation?: SimulationResponse | null;
  /**
   * Atomic Slope pin-draft store plan (same package as network Hero).
   * When set, Inspect Plan must use this — never stale allocate beside new network.
   */
  slopeStorePlanOverride?: { planYs: (number | null)[]; planCumYs: (number | null)[] } | null;
  /** Store evaluation Y-axis title. Default keeps the 5% planner label. */
  yAxisTitle?: string;
  /** Appended to store evaluation tick labels. Default `%`. */
  tickSuffix?: string;
}

/**
 * V4.2 Component F — store audit + ephemeral sandbox.
 * EXP layout: full-width Store Hero · accordion panels below (At-risk style).
 */
export function StoreAuditDrawer<T extends DirectedPlan>({
  open,
  storeId,
  plan,
  panel,
  insights,
  processResult,
  maxMonthlyImprove,
  baselineRows = [],
  onClose,
  onStoreChange,
  onApplyPlan,
  unreachableHint = null,
  onApplyUnreachableSuggestion,
  unreachableApplyPending = false,
  boostGlance = null,
  slopeSimulation = null,
  slopeStorePlanOverride = null,
  yAxisTitle,
  tickSuffix,
}: StoreAuditDrawerProps<T>) {
  const t = useT();
  const storeIds = useMemo(
    () =>
      [...new Set(plan.projections.map((p) => p.store_id))].sort((a, b) => a - b),
    [plan.projections],
  );
  const slopeLayers = useMemo(
    () =>
      slopeSimulation != null
        ? buildStoreCumulativeSlopeLayers(
            slopeSimulation,
            storeId,
            slopeStorePlanOverride,
          )
        : null,
    [slopeSimulation, storeId, slopeStorePlanOverride],
  );
  const slopeAlign = useMemo(
    () => (slopeLayers != null ? buildInspectSlopeAlign(slopeLayers) : null),
    [slopeLayers],
  );
  const projection = plan.projections.find((p) => p.store_id === storeId);
  const monitorRow: StoreMonitorRow | undefined = insights.stores.find(
    (s) => s.store_id === storeId,
  );
  const periods = plan.chain_trajectory;
  const lastIdx = periods.length - 1;
  const lastPeriod = periods[lastIdx];
  const originalLast =
    projection?.months.find((m) => m.year === lastPeriod?.year && m.month === lastPeriod?.month)
      ?.score ?? null;
  const previous =
    lastIdx > 0
      ? projection?.months.find(
          (m) =>
            m.year === periods[lastIdx - 1].year && m.month === periods[lastIdx - 1].month,
        )?.score ?? null
      : null;

  const {
    digits: scoreDigits,
    floor: scoreFloor,
    ceiling: scoreCeiling,
  } = scoreDisplayForUnit(plan.unit);
  const formatScore = (value: number) => formatScoreValue(value, scoreDigits);
  const bounds =
    originalLast == null
      ? { min: scoreFloor, max: scoreCeiling }
      : sandboxScoreBounds(
          previous,
          originalLast,
          maxMonthlyImprove,
          scoreFloor,
          scoreCeiling,
        );

  const steps = processResult ? sortPipelineSteps(processResult.steps) : [];
  const echo = panel.echo_config;

  const [inputValue, setInputValue] = useState(
    originalLast == null ? '' : formatScore(originalLast),
  );
  const [appliedDraft, setAppliedDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SandboxEvenSplitPreview | null>(null);
  /** Estimate funnel — collapsed by default (Pipeline steps / At-risk pattern). */
  const [sandboxExpanded, setSandboxExpanded] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [applyToastOpen, setApplyToastOpen] = useState(false);

  useEffect(() => {
    if (open && originalLast != null) {
      setInputValue(originalLast.toFixed(scoreDigits));
      setAppliedDraft(null);
      setPreview(null);
      setError(null);
      setSandboxExpanded(false);
      setPoolDialogOpen(false);
    }
  }, [open, storeId, originalLast, scoreDigits]);

  const baseTable = useMemo(
    () => buildStorePlanActualDifferenceTable(plan, storeId, panel, insights, monitorRow),
    [plan, storeId, panel, insights, monitorRow],
  );

  const displayTable = useMemo(() => {
    if (!baseTable) return null;
    return applyDraftLastMonthToTable(baseTable, appliedDraft, plan.direction);
  }, [baseTable, appliedDraft, plan.direction]);

  const editableCol = displayTable ? lastEstimateIndex(displayTable) : -1;

  const handleRecalculate = () => {
    if (originalLast == null || projection == null || !lastPeriod) {
      return;
    }
    const parsed = Number(inputValue);
    if (Number.isNaN(parsed)) {
      setError('Enter a valid number.');
      return;
    }
    if (parsed < bounds.min - 1e-9 || parsed > bounds.max + 1e-9) {
      setError(
        `Value out of range. Enter a value between ${formatScore(bounds.min)} and ${formatScore(bounds.max)}.`,
      );
      return;
    }
    const draft = clipSandboxScore(parsed, bounds);
    setError(null);
    setAppliedDraft(draft);
    const others = insights.stores
      .filter((row) => row.store_id !== storeId)
      .map((row) => {
        const last =
          plan.projections
            .find((p) => p.store_id === row.store_id)
            ?.months.find((m) => m.year === lastPeriod.year && m.month === lastPeriod.month)
            ?.score ?? row.planned ?? 0;
        return { store_id: row.store_id, last, signal: row.signal };
      });
    setPreview(
      previewSandboxEvenSplit({
        selectedStoreId: storeId,
        selectedSignal: monitorRow?.signal ?? 'on_plan',
        originalLast,
        proposedLast: draft,
        previousScore: previous,
        others,
        maxMonthlyImprove,
        floor: scoreFloor,
        ceiling: scoreCeiling,
      }),
    );
  };

  const clearLocalSandbox = () => {
    if (originalLast != null) {
      setInputValue(formatScore(originalLast));
    }
    setAppliedDraft(null);
    setPreview(null);
    setError(null);
    setPoolDialogOpen(false);
  };

  const handleApply = () => {
    if (!preview || !lastPeriod) {
      return;
    }
    const next = applySandboxEvenSplitToPlan(
      plan,
      preview,
      lastPeriod.year,
      lastPeriod.month,
    );
    onApplyPlan(next);
    clearLocalSandbox();
    setApplyToastOpen(true);
  };

  /** Clears Estimate preview only — session draft revert lives on Planner. */
  const handleReset = () => {
    clearLocalSandbox();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      scroll="paper"
      data-testid="store-inspect-dialog"
      PaperProps={{
        sx: {
          height: { xs: '100%', md: '90vh' },
          maxHeight: { xs: '100%', md: '90vh' },
          m: { xs: 0, md: 2 },
          width: { xs: '100%', md: 'calc(100% - 32px)' },
          maxWidth: { md: INSPECT_DIALOG_PAPER_MAX_PX },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <StoreAuditDialogTitle
        storeIds={storeIds}
        storeId={storeId}
        onStoreChange={onStoreChange}
        onClose={onClose}
        monitorRow={monitorRow}
        echo={echo}
        steps={steps}
      />

      <DialogContent
        dividers
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          py: 1.5,
          px: 2,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <InspectStoreGlance
          plan={plan}
          insights={insights}
          storeId={storeId}
          baselineRows={baselineRows}
          draftLast={appliedDraft}
          slopeAlign={slopeAlign}
        />
        {boostGlance != null ? (
          <Alert
            severity="info"
            variant="outlined"
            data-testid="inspect-boost-glance"
            sx={{ flexShrink: 0, mb: 1, py: 0.5 }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {t('planner.inspect.boostTitle')}
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('planner.inspect.boostGap', {
                  gap: boostGlance.gapToMean.toFixed(1),
                })}
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('planner.inspect.boostSlope', {
                  slope: boostGlance.slope.toFixed(2),
                })}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {t('planner.inspect.boostHint')}
            </Typography>
          </Alert>
        ) : null}
        {unreachableHint != null && onApplyUnreachableSuggestion != null ? (
          <UnreachableRecommendationCard
            hint={unreachableHint}
            onApply={onApplyUnreachableSuggestion}
            applyPending={unreachableApplyPending}
          />
        ) : null}
        <StoreAuditHero
          plan={plan}
          storeId={storeId}
          panel={panel}
          insights={insights}
          draftLast={appliedDraft}
          slopeLayers={slopeLayers}
          yAxisTitle={yAxisTitle}
          tickSuffix={tickSuffix}
        />

        <StoreAuditSandboxPanel
          storeId={storeId}
          scoreDigits={scoreDigits}
          sandboxExpanded={sandboxExpanded}
          onSandboxExpandedChange={setSandboxExpanded}
          preview={preview}
          originalLast={originalLast}
          displayTable={displayTable}
          editableCol={editableCol}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          error={error}
          bounds={bounds}
          lastPeriod={lastPeriod}
          appliedDraft={appliedDraft}
          onRecalculate={handleRecalculate}
          onApply={handleApply}
          onReset={handleReset}
          poolDialogOpen={poolDialogOpen}
          onPoolDialogOpenChange={setPoolDialogOpen}
          applyToastOpen={applyToastOpen}
          onApplyToastClose={() => setApplyToastOpen(false)}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="contained" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
