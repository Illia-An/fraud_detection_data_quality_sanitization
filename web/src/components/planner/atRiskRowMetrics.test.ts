import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import {
  behindStreakMonths,
  gapShareOfBehind,
  momTrendPp,
  panelVolume,
  previousCalendarMonth,
} from './atRiskRowMetrics';

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
    { year: 2025, month: 3, score: 70 },
    { year: 2025, month: 4, score: 71 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 3, score: 70 },
        { year: 2025, month: 4, score: 72 },
      ],
    },
  ],
};

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 2,
  rows: [
    { store_id: 10, year: 2025, month: 3, five_percent: 64, survey_volume: 90 },
    { store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 100 },
  ],
};

describe('atRiskRowMetrics', () => {
  it('computes previous calendar month across year boundary', () => {
    expect(previousCalendarMonth(2025, 1)).toEqual({ year: 2024, month: 12 });
    expect(previousCalendarMonth(2025, 4)).toEqual({ year: 2025, month: 3 });
  });

  it('reads as-of volume and MoM trend', () => {
    expect(panelVolume(panel, 10, 2025, 4)).toBe(100);
    expect(momTrendPp(panel, 10, 2025, 4)).toBe(2);
  });

  it('counts consecutive behind months from as-of backward', () => {
    // Mar: 64−70=−6 behind; Apr: 66−72=−6 behind → streak 2
    expect(behindStreakMonths(plan, panel, 10, 2025, 4, 1)).toBe(2);
  });

  it('shares absolute behind gap', () => {
    expect(gapShareOfBehind(-2, 8)).toBeCloseTo(0.25, 5);
    expect(gapShareOfBehind(1, 8)).toBeNull();
  });
});
