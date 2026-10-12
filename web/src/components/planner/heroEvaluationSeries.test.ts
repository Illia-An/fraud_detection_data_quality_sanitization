import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import {
  buildHeroEvaluationSeries,
  cumulativeMeanSeries,
  linearCumulativePathToTarget,
  monthlyFromCumulativePath,
  shiftCalendarMonths,
} from './heroEvaluationSeries';

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 3,
  rows: [
    { store_id: 10, year: 2025, month: 2, five_percent: 68, survey_volume: 80 },
    { store_id: 20, year: 2025, month: 2, five_percent: 72, survey_volume: 90 },
    { store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 85 },
    { store_id: 20, year: 2025, month: 3, five_percent: 74, survey_volume: 95 },
  ],
};

const draft: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 72,
  required_change: 3,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 73 },
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    { store_id: 10, months: [{ year: 2025, month: 4, score: 71 }] },
    { store_id: 20, months: [{ year: 2025, month: 4, score: 75 }] },
  ],
};

describe('cumulativeMeanSeries', () => {
  it('computes running mean of monthly scores to hundredths', () => {
    expect(cumulativeMeanSeries([70, 80, 100])).toEqual([70, 75, 83.33]);
    expect(cumulativeMeanSeries([70, null, 80])).toEqual([70, null, 75]);
  });
});

describe('shiftCalendarMonths', () => {
  it('shifts across year boundaries', () => {
    expect(shiftCalendarMonths(2025, 3, -3)).toEqual({ year: 2024, month: 12 });
    expect(shiftCalendarMonths(2025, 10, -3)).toEqual({ year: 2025, month: 7 });
    expect(shiftCalendarMonths(2025, 1, 2)).toEqual({ year: 2025, month: 3 });
  });
});

describe('linearCumulativePathToTarget', () => {
  it('reaches target on the last horizon step', () => {
    expect(linearCumulativePathToTarget(71, 75, 2)).toEqual([73, 75]);
    expect(linearCumulativePathToTarget(85, 90, 1)).toEqual([90]);
    expect(linearCumulativePathToTarget(80, 80, 3)).toEqual([80, 80, 80]);
  });
});

describe('monthlyFromCumulativePath', () => {
  it('inverts running-mean levels into monthlies that rebuild the path', () => {
    expect(monthlyFromCumulativePath(71, 2, [73, 75])).toEqual([77, 81]);
    expect(cumulativeMeanSeries([70, 72, 77, 81])).toEqual([70, 71, 73, 75]);
  });
});

describe('buildHeroEvaluationSeries', () => {
  it('puts cleansed fact left of as-of and draft forecast from as-of onward', () => {
    const series = buildHeroEvaluationSeries(draft, panel, { year: 2025, month: 3 }, 1.5);

    expect(series.asOfLabel).toBe('2025-03');
    expect(series.windowStartLabel).toBe('2024-12');
    // −3 mo marker month is on the axis even without a panel row
    expect(series.labels).toEqual(['2024-12', '2025-02', '2025-03', '2025-04', '2025-05']);
    expect(series.factYs[0]).toBeNull();
    expect(series.factYs[1]).toBeCloseTo(70, 2);
    expect(series.factYs[2]).toBeCloseTo(72, 2);

    expect(series.cumulativeYs[1]).toBeCloseTo(70, 2);
    expect(series.cumulativeYs[2]).toBeCloseTo(71, 2);

    // Orange: short-window actual 70→71, then linear to target 75 over 2 months
    expect(series.windowCumulativeYs[1]).toBeCloseTo(70, 2);
    expect(series.windowCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(series.windowCumulativeYs[3]).toBeCloseTo(73, 2); // 71 + (75-71)/2
    expect(series.windowCumulativeYs[4]).toBeCloseTo(75, 2); // lands on target

    // Green: pure draft cumulative
    expect(series.planCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(series.planCumulativeYs[3]).toBeCloseTo(71.67, 2);
    expect(series.planCumulativeYs[4]).toBeCloseTo(72.25, 2);

    expect(series.draftYs[2]).toBeCloseTo(71, 5);
    expect(series.draftYs[3]).toBeCloseTo(73, 5);
    expect(series.target).toBe(75);

    // Required monthly from −3 window handoff: stitch 72, then 77/81 → green hits 75
    expect(series.requiredMonthlyYs[1]).toBeNull();
    expect(series.requiredMonthlyYs[2]).toBeCloseTo(72, 2);
    expect(series.requiredMonthlyYs[3]).toBeCloseTo(77, 2);
    expect(series.requiredMonthlyYs[4]).toBeCloseTo(81, 2);
    expect(cumulativeMeanSeries([70, 72, 77, 81])).toEqual([70, 71, 73, 75]);
    // Required cumulative = cum(window + required monthly) → lands on target (pair with gray)
    expect(series.requiredCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(series.requiredCumulativeYs[3]).toBeCloseTo(73, 2);
    expect(series.requiredCumulativeYs[4]).toBeCloseTo(75, 2);
  });

  it('draws orange path-to-target from short-window handoff', () => {
    const longPanel: SanitizedPanel = {
      ...panel,
      reference_month: 6,
      rows: [
        { store_id: 10, year: 2025, month: 1, five_percent: 50, survey_volume: 80 },
        { store_id: 10, year: 2025, month: 2, five_percent: 60, survey_volume: 80 },
        { store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 80 },
        { store_id: 10, year: 2025, month: 4, five_percent: 80, survey_volume: 80 },
        { store_id: 10, year: 2025, month: 5, five_percent: 90, survey_volume: 80 },
        { store_id: 10, year: 2025, month: 6, five_percent: 100, survey_volume: 80 },
      ],
    };
    const longDraft: FivePercentPlan = {
      ...draft,
      target: 90,
      chain_trajectory: [{ year: 2025, month: 7, score: 101 }],
      projections: [{ store_id: 10, months: [{ year: 2025, month: 7, score: 101 }] }],
    };
    const series = buildHeroEvaluationSeries(
      longDraft,
      longPanel,
      { year: 2025, month: 6 },
      1.5,
    );

    expect(series.windowStartLabel).toBe('2025-03');
    expect(series.windowCumulativeYs[2]).toBeCloseTo(70, 2);
    expect(series.windowCumulativeYs[5]).toBeCloseTo(85, 2); // handoff
    // One horizon step → lands on target 90
    expect(series.windowCumulativeYs[6]).toBeCloseTo(90, 2);
    // Green still follows pure draft (88.2), not forced to target
    expect(series.planCumulativeYs[5]).toBeCloseTo(85, 2);
    expect(series.planCumulativeYs[6]).toBeCloseTo(88.2, 2);
    expect(series.target).toBe(90);
  });

  it('keeps green on draft when as-of is first trajectory month', () => {
    const series = buildHeroEvaluationSeries(draft, panel, { year: 2025, month: 4 }, 1.5);

    // Window start Jan on axis; handoff Mar=71; horizon Apr+May → 73, 75 to target
    expect(series.windowStartLabel).toBe('2025-01');
    expect(series.labels[0]).toBe('2025-01');
    expect(series.windowCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(series.windowCumulativeYs[3]).toBeCloseTo(73, 2);
    expect(series.windowCumulativeYs[4]).toBeCloseTo(75, 2);
    expect(series.planCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(series.planCumulativeYs[3]).toBeCloseTo(71.67, 2);
    expect(series.planCumulativeYs[4]).toBeCloseTo(72.25, 2);
  });

  it('draws realized cleansed fact after as-of without shifting planning handoff', () => {
    const panelWithLater: SanitizedPanel = {
      ...panel,
      reference_month: 4,
      rows: [
        ...panel.rows,
        { store_id: 10, year: 2025, month: 4, five_percent: 80, survey_volume: 85 },
        { store_id: 20, year: 2025, month: 4, five_percent: 84, survey_volume: 95 },
      ],
    };
    const series = buildHeroEvaluationSeries(
      draft,
      panelWithLater,
      { year: 2025, month: 3 },
      1.5,
    );

    // Apr network fact = (80+84)/2 = 82 — display only after as-of
    expect(series.factYs[3]).toBeCloseTo(82, 2);
    expect(series.cumulativeYs[3]).toBeCloseTo(74.67, 2); // (70+72+82)/3
    // Planning handoff still Mar: required / orange ignore Apr fact
    expect(series.requiredMonthlyYs[2]).toBeCloseTo(72, 2);
    expect(series.requiredMonthlyYs[3]).toBeCloseTo(77, 2);
    expect(series.requiredCumulativeYs[3]).toBeCloseTo(73, 2);
    expect(series.windowCumulativeYs[3]).toBeCloseTo(73, 2);
    expect(series.planCumulativeYs[3]).toBeCloseTo(71.67, 2);
  });
});
