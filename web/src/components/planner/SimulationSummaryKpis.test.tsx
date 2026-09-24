import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { appTheme } from '../../theme';
import { SimulationSummaryKpis } from './SimulationSummaryKpis';

const draft: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [{ year: 2025, month: 4, score: 74 }],
  projections: [],
};

const monitoring: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 74, actual: null, on_track: null },
  months: [],
  stores: [],
  summary: { ahead: 0, on_plan: 2, behind: 3, insufficient: 1 },
};

describe('SimulationSummaryKpis', () => {
  it('renders target, projected delta, and behind count', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <SimulationSummaryKpis draftPlan={draft} approvedPlan={null} monitoring={monitoring} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Target KPI')).toBeInTheDocument();
    expect(screen.getByText(/70\.0% → 74\.0%/)).toBeInTheDocument();
    expect(screen.getByText('+4.0 pp')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/quota N\/A/i)).toBeInTheDocument();
  });
});
