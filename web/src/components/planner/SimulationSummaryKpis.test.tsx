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
  it('renders Current → Final projected delta, behind count, and feasibility', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <SimulationSummaryKpis draftPlan={draft} monitoring={monitoring} />
      </ThemeProvider>,
    );

    expect(screen.queryByText('Target KPI')).not.toBeInTheDocument();
    // Always Current → Final (never approved Final → draft Final).
    expect(screen.getByText(/70\.00% → 74\.00%/)).toBeInTheDocument();
    expect(screen.getByText('+4.00 pp')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/quota N\/A/i)).toBeInTheDocument();
  });

  it('keeps Current on the left even when Final equals a prior approved snapshot', () => {
    const nearTarget: FivePercentPlan = {
      ...draft,
      current_chain: 61.06,
      final_chain: 75.47,
      required_change: 75 - 61.06,
    };
    render(
      <ThemeProvider theme={appTheme}>
        <SimulationSummaryKpis draftPlan={nearTarget} monitoring={monitoring} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/61\.06% → 75\.47%/)).toBeInTheDocument();
  });
});
