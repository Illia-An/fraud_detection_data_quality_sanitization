import { useEffect, useMemo, useState } from 'react';

import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import {
  applyDraftLastMonthToTable,
  buildStorePlanActualDifferenceTable,
  lastEstimateIndex,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights, StoreMonitorRow } from '../../schemas/planMonitoring';
import {
  applySandboxEvenSplitToPlan,
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
  type SandboxEvenSplitPreview,
} from '../../schemas/sandboxPreview';
import {
  formatScore as formatScoreValue,
  scoreDisplayForUnit,
} from './storeAudit/storeAuditFormat';

interface UseStoreAuditSandboxArgs<T extends DirectedPlan> {
  storeId: number;
  plan: T;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  maxMonthlyImprove: number;
  onApplyPlan: (plan: T) => void;
  /** When true, reset local estimate state (e.g. dialog open / store change). */
  active: boolean;
}

/**
 * Estimate-vs-actual sandbox state shared by Inspect dialog and full-page Inspect.
 */
export function useStoreAuditSandbox<T extends DirectedPlan>({
  storeId,
  plan,
  panel,
  insights,
  maxMonthlyImprove,
  onApplyPlan,
  active,
}: UseStoreAuditSandboxArgs<T>) {
  const monitorRow: StoreMonitorRow | undefined = insights.stores.find(
    (s) => s.store_id === storeId,
  );
  const projection = plan.projections.find((p) => p.store_id === storeId);
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

  const [inputValue, setInputValue] = useState(
    originalLast == null ? '' : formatScore(originalLast),
  );
  const [appliedDraft, setAppliedDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SandboxEvenSplitPreview | null>(null);
  const [sandboxExpanded, setSandboxExpanded] = useState(true);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [applyToastOpen, setApplyToastOpen] = useState(false);

  useEffect(() => {
    if (active && originalLast != null) {
      setInputValue(originalLast.toFixed(scoreDigits));
      setAppliedDraft(null);
      setPreview(null);
      setError(null);
      setPoolDialogOpen(false);
    }
  }, [active, storeId, originalLast, scoreDigits]);

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
            ?.score ??
          row.planned ??
          0;
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

  const handleReset = () => {
    clearLocalSandbox();
  };

  return {
    monitorRow,
    lastPeriod,
    originalLast,
    scoreDigits,
    bounds,
    inputValue,
    setInputValue,
    appliedDraft,
    error,
    preview,
    sandboxExpanded,
    setSandboxExpanded,
    poolDialogOpen,
    setPoolDialogOpen,
    applyToastOpen,
    setApplyToastOpen,
    displayTable,
    editableCol,
    handleRecalculate,
    handleApply,
    handleReset,
  };
}
