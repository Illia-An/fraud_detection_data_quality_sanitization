import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import { HeroSimulationChart } from './HeroSimulationChart';

vi.mock('react-plotly.js', () => ({
  default: (props: { layout?: { shapes?: unknown[]; annotations?: unknown[] }; data?: unknown[] }) => (
    <div data-testid="hero-plotly">{JSON.stringify(props)}</div>
  ),
}));

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 2,
  rows: [
    { store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 90 },
    { store_id: 20, year: 2025, month: 3, five_percent: 74, survey_volume: 80 },
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

describe('HeroSimulationChart', () => {
  it('renders evaluation view with as-of boundary and fact/forecast traces', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <HeroSimulationChart
          draftPlan={draft}
          approvedPlan={null}
          panel={panel}
          asOfYear={2025}
          asOfMonth={3}
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('hero-plotly')).toBeInTheDocument();
    });
    const payload = screen.getByTestId('hero-plotly').textContent ?? '';
    expect(payload).toContain('Cleansed fact');
    expect(payload).toContain('Cumulative actual');
    expect(payload).toContain('Cumulative plan');
    expect(payload).toContain('Draft simulation');
    expect(payload).toContain('as-of');
    expect(payload).toContain('2025-03');
    expect(payload).toContain('"scrollZoom":true');
    expect(screen.getByText(/not a statistical confidence interval/i)).toBeInTheDocument();
    expect(screen.getByText(/mouse wheel zooms/i)).toBeInTheDocument();
  });
});
