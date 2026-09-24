import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import type { FivePercentPlan } from '../../schemas/plan';
import { appTheme } from '../../theme';
import { HeroSimulationChart } from './HeroSimulationChart';

vi.mock('react-plotly.js', () => ({
  default: (props: { 'data-testid'?: string }) => (
    <div data-testid="hero-plotly">{JSON.stringify(props)}</div>
  ),
}));

const draft: FivePercentPlan = {
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
  projections: [],
};

describe('HeroSimulationChart', () => {
  it('renders plotly hero and slack-band note', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <HeroSimulationChart draftPlan={draft} approvedPlan={null} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('hero-plotly')).toBeInTheDocument();
    });
    expect(screen.getByText(/not a statistical confidence interval/i)).toBeInTheDocument();
  });
});
