import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { appTheme } from '../../theme';
import { AtRiskDeltaTable } from './AtRiskDeltaTable';

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
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 4, score: 68 },
        { year: 2025, month: 5, score: 72 },
      ],
    },
    {
      store_id: 20,
      months: [
        { year: 2025, month: 4, score: 72 },
        { year: 2025, month: 5, score: 78 },
      ],
    },
  ],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 70, on_track: true },
  months: [],
  stores: [
    {
      store_id: 10,
      signal: 'behind_plan',
      planned: 68,
      actual: 66,
      deviation: -2,
    },
    {
      store_id: 20,
      signal: 'ahead_of_plan',
      planned: 72,
      actual: 74,
      deviation: 2,
    },
  ],
  summary: { ahead: 1, on_plan: 0, behind: 1, insufficient: 0 },
};

describe('AtRiskDeltaTable', () => {
  it('filters behind stores and calls Inspect', () => {
    const onInspect = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <AtRiskDeltaTable
          plan={plan}
          approvedPlan={null}
          baselineRows={[
            { store_id: 10, five_percent: 65 },
            { store_id: 20, five_percent: 70 },
          ]}
          insights={insights}
          asOfOptions={[
            { year: 2025, month: 4 },
            { year: 2025, month: 5 },
          ]}
          onAsOfChange={vi.fn()}
          onInspect={onInspect}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('At risk (behind)')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));
    expect(onInspect).toHaveBeenCalledWith(10);
  });
});
