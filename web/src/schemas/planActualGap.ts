/** Plan vs actual gap model — port of Angular monitoring.models (five_percent only). */

import type { FivePercentPlan } from './plan';
import { periodLabel } from './plan';
import type { PlanMonitoringInsights, StoreMonitorRow } from './planMonitoring';
import { SIGNAL_COLORS } from './planMonitoring';
import type { SanitizedPanel } from './sanitizedPanel';

export type MetricDirection = 'higher_is_better';

export interface PlanActualGapPoint {
  index: number;
  label: string;
  year: number;
  month: number;
  planned: number | null;
  actual: number | null;
  chain: number | null;
  isAsOf: boolean;
}

export interface PlanActualGapModel {
  storeId: number;
  points: PlanActualGapPoint[];
  asOfIndex: number | null;
  plannedAtAsOf: number | null;
  actualAtAsOf: number | null;
  deviation: number | null;
}

export interface StorePlanActualMonthColumn {
  label: string;
  year: number;
  month: number;
  isAsOf: boolean;
}

/** One selected store: plan estimate vs actual vs direction-aware difference. */
export interface StorePlanActualTable {
  storeId: number;
  columns: StorePlanActualMonthColumn[];
  estimate: Array<number | null>;
  actual: Array<number | null>;
  difference: Array<number | null>;
}

/** Signed deviation from plan (positive = better than planned). */
export function directionAwareDeviation(
  actual: number | null | undefined,
  planned: number | null | undefined,
  direction: MetricDirection = 'higher_is_better',
): number | null {
  if (actual == null || planned == null || !Number.isFinite(actual) || !Number.isFinite(planned)) {
    return null;
  }
  if (direction === 'higher_is_better') {
    return actual - planned;
  }
  return planned - actual;
}

/** Fill color for signed deviation (matches Plan monitoring signal palette). */
export function monitoringDeviationFill(deviation: number | null | undefined): string {
  if (deviation == null || !Number.isFinite(deviation)) {
    return SIGNAL_COLORS.on_plan;
  }
  if (deviation > 1e-9) {
    return SIGNAL_COLORS.ahead_of_plan;
  }
  if (deviation < -1e-9) {
    return SIGNAL_COLORS.behind_plan;
  }
  return SIGNAL_COLORS.on_plan;
}

function panelActual(
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.five_percent ?? null;
}

/**
 * Plan curve from projections + cleansed actuals + chain trajectory.
 * As-of gap uses the monitoring store row so the labeled deviation matches Plan monitoring.
 */
export function buildMonitoringPlanActualGapModel(
  plan: FivePercentPlan,
  storeId: number,
  panel: SanitizedPanel,
  insights: PlanMonitoringInsights,
  monitorRow?: StoreMonitorRow | null,
): PlanActualGapModel | null {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection || plan.chain_trajectory.length === 0) {
    return null;
  }

  const row =
    monitorRow ?? insights.stores.find((s) => s.store_id === storeId) ?? null;

  const points: PlanActualGapPoint[] = plan.chain_trajectory.map((period, index) => {
    const planned =
      projection.months.find((m) => m.year === period.year && m.month === period.month)?.score ??
      null;
    return {
      index,
      label: periodLabel(period.year, period.month),
      year: period.year,
      month: period.month,
      planned,
      actual: panelActual(panel, storeId, period.year, period.month),
      chain: period.score,
      isAsOf: period.year === insights.as_of_year && period.month === insights.as_of_month,
    };
  });

  const asOfIndex = points.findIndex((point) => point.isAsOf);
  if (asOfIndex >= 0 && row) {
    const asOf = points[asOfIndex];
    points[asOfIndex] = {
      ...asOf,
      planned: asOf.planned ?? row.planned,
      actual: asOf.actual ?? row.actual,
    };
  }

  const asOf = asOfIndex >= 0 ? points[asOfIndex] : null;
  return {
    storeId,
    points,
    asOfIndex: asOfIndex >= 0 ? asOfIndex : null,
    plannedAtAsOf: asOf?.planned ?? row?.planned ?? null,
    actualAtAsOf: asOf?.actual ?? row?.actual ?? null,
    deviation: row?.deviation ?? null,
  };
}

/** Overlay a sandbox last planned point without mutating the source gap model. */
export function applyDraftLastMonthToGapModel(
  model: PlanActualGapModel,
  draftLast: number | null | undefined,
  direction: MetricDirection = 'higher_is_better',
): PlanActualGapModel {
  if (draftLast == null || !Number.isFinite(draftLast)) {
    return model;
  }
  let lastIndex = -1;
  for (let index = model.points.length - 1; index >= 0; index -= 1) {
    if (model.points[index].planned != null && Number.isFinite(model.points[index].planned)) {
      lastIndex = index;
      break;
    }
  }
  if (lastIndex < 0) {
    return model;
  }

  const points = [...model.points];
  points[lastIndex] = { ...points[lastIndex], planned: draftLast };
  const isAsOfPoint = model.asOfIndex === lastIndex;
  return {
    ...model,
    points,
    plannedAtAsOf: isAsOfPoint ? draftLast : model.plannedAtAsOf,
    deviation: isAsOfPoint
      ? directionAwareDeviation(model.actualAtAsOf, draftLast, direction)
      : model.deviation,
  };
}

/** Read-only table under Plan vs actual. Months match the gap chart. */
export function buildStorePlanActualDifferenceTable(
  plan: FivePercentPlan,
  storeId: number,
  panel: SanitizedPanel,
  insights: PlanMonitoringInsights,
  monitorRow?: StoreMonitorRow | null,
): StorePlanActualTable | null {
  const model = buildMonitoringPlanActualGapModel(plan, storeId, panel, insights, monitorRow);
  if (!model) {
    return null;
  }
  const direction = plan.direction;
  return {
    storeId: model.storeId,
    columns: model.points.map((point) => ({
      label: point.label,
      year: point.year,
      month: point.month,
      isAsOf: point.isAsOf,
    })),
    estimate: model.points.map((point) => point.planned),
    actual: model.points.map((point) => point.actual),
    difference: model.points.map((point) =>
      directionAwareDeviation(point.actual, point.planned, direction),
    ),
  };
}

/** Last column with a numeric estimate (the plan-horizon end month). */
export function lastEstimateIndex(table: StorePlanActualTable): number {
  for (let index = table.estimate.length - 1; index >= 0; index -= 1) {
    if (table.estimate[index] != null && Number.isFinite(table.estimate[index])) {
      return index;
    }
  }
  return -1;
}

/** Overlay a sandbox last-month estimate without mutating the source table. */
export function applyDraftLastMonthToTable(
  table: StorePlanActualTable,
  draftLast: number | null | undefined,
  direction: MetricDirection = 'higher_is_better',
): StorePlanActualTable {
  const lastIndex = lastEstimateIndex(table);
  if (lastIndex < 0 || draftLast == null || !Number.isFinite(draftLast)) {
    return table;
  }
  const estimate = [...table.estimate];
  estimate[lastIndex] = draftLast;
  const difference = [...table.difference];
  difference[lastIndex] = directionAwareDeviation(table.actual[lastIndex], draftLast, direction);
  return { ...table, estimate, difference };
}
