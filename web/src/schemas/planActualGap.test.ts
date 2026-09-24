import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from './api';
import type { FivePercentPlan } from './plan';
import type { PlanMonitoringInsights } from './planMonitoring';
import type { SanitizedPanel } from './sanitizedPanel';
import {
  applyDraftLastMonthToGapModel,
  applyDraftLastMonthToTable,
  buildMonitoringPlanActualGapModel,
  buildStorePlanActualDifferenceTable,
  directionAwareDeviation,
  lastEstimateIndex,
  monitoringDeviationFill,
} from './planActualGap';
import { SIGNAL_COLORS } from './planMonitoring';

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 71 },
    { year: 2025, month: 5, score: 72.5 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 4, score: 68 },
        { year: 2025, month: 5, score: 70 },
      ],
    },
  ],
};

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 4,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 50 }],
};

const insightsAsOfLast: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 5,
  band_pp: 1,
  chain: { planned: 72.5, actual: null, on_track: null },
  months: [],
  stores: [
    {
      store_id: 10,
      signal: 'insufficient_history',
      planned: 70,
      actual: null,
      deviation: null,
    },
  ],
  summary: { ahead: 0, on_plan: 0, behind: 0, insufficient: 1 },
};

const insightsAsOfFirst: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 71, on_track: true },
  months: [],
  stores: [
    {
      store_id: 10,
      signal: 'behind_plan',
      planned: 68,
      actual: 66,
      deviation: -2,
    },
  ],
  summary: { ahead: 0, on_plan: 0, behind: 1, insufficient: 0 },
};

describe('planActualGap', () => {
  it('directionAwareDeviation is actual − planned for higher_is_better', () => {
    expect(directionAwareDeviation(66, 68)).toBe(-2);
    expect(directionAwareDeviation(70, 68)).toBe(2);
    expect(directionAwareDeviation(null, 68)).toBeNull();
  });

  it('monitoringDeviationFill maps signed gap to signal colors', () => {
    expect(monitoringDeviationFill(2)).toBe(SIGNAL_COLORS.ahead_of_plan);
    expect(monitoringDeviationFill(-1)).toBe(SIGNAL_COLORS.behind_plan);
    expect(monitoringDeviationFill(0)).toBe(SIGNAL_COLORS.on_plan);
  });

  it('builds gap model with plan / actual / chain and monitoring deviation', () => {
    const model = buildMonitoringPlanActualGapModel(plan, 10, panel, insightsAsOfFirst);
    expect(model).not.toBeNull();
    expect(model!.points).toHaveLength(2);
    expect(model!.points[0]).toMatchObject({
      planned: 68,
      actual: 66,
      chain: 71,
      isAsOf: true,
    });
    expect(model!.points[1].actual).toBeNull();
    expect(model!.asOfIndex).toBe(0);
    expect(model!.deviation).toBe(-2);
  });

  it('applyDraftLastMonthToGapModel recalculates gap only when as of = last month', () => {
    const panelWithLastActual: SanitizedPanel = {
      ...panel,
      rows: [
        ...panel.rows,
        { store_id: 10, year: 2025, month: 5, five_percent: 68, survey_volume: 50 },
      ],
    };
    const asOfLast = buildMonitoringPlanActualGapModel(plan, 10, panelWithLastActual, {
      ...insightsAsOfLast,
      stores: [
        {
          store_id: 10,
          signal: 'behind_plan',
          planned: 70,
          actual: 68,
          deviation: -2,
        },
      ],
    })!;
    expect(asOfLast.asOfIndex).toBe(1);

    const overlaid = applyDraftLastMonthToGapModel(asOfLast, 66);
    expect(overlaid.points[1].planned).toBe(66);
    expect(overlaid.plannedAtAsOf).toBe(66);
    expect(overlaid.deviation).toBeCloseTo(2, 5); // 68 − 66
    expect(overlaid.points[1].actual).toBe(68);
    expect(overlaid.points[1].chain).toBe(72.5);
  });

  it('applyDraftLastMonthToGapModel keeps monitoring deviation when as of ≠ last', () => {
    const model = buildMonitoringPlanActualGapModel(plan, 10, panel, insightsAsOfFirst)!;
    const overlaid = applyDraftLastMonthToGapModel(model, 72);
    expect(overlaid.points[1].planned).toBe(72);
    expect(overlaid.plannedAtAsOf).toBe(68);
    expect(overlaid.deviation).toBe(-2);
  });

  it('builds estimate vs actual table and applies draft overlay', () => {
    const table = buildStorePlanActualDifferenceTable(plan, 10, panel, insightsAsOfFirst);
    expect(table).not.toBeNull();
    expect(lastEstimateIndex(table!)).toBe(1);
    expect(table!.difference[0]).toBe(-2);

    const drafted = applyDraftLastMonthToTable(table!, 72);
    expect(drafted.estimate[1]).toBe(72);
    expect(drafted.difference[1]).toBeNull(); // no actual in May
  });
});
