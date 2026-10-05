import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import { StoreHeroEvaluationChart } from './StoreHeroEvaluationChart';

vi.mock('react-plotly.js', () => ({
  default: (props: { layout?: { shapes?: unknown[] }; data?: unknown[] }) => (
    <div data-testid="store-hero-plotly">{JSON.stringify(props)}</div>
  ),
}));

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
  ],
};

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 4,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 100 }],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 66, on_track: false },
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

describe('StoreHeroEvaluationChart', () => {
  it('renders store evaluation traces and as-of marker', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <StoreHeroEvaluationChart
          plan={plan}
          storeId={10}
          panel={panel}
          insights={insights}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('store-hero-evaluation-chart')).toBeInTheDocument();
    expect(screen.getByText(/Store evaluation/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('store-hero-plotly')).toBeInTheDocument();
    });
    const payload = screen.getByTestId('store-hero-plotly').textContent ?? '';
    expect(payload).toContain('Cleansed fact');
    expect(payload).toContain('Cumulative actual');
    expect(payload).toContain('Cumulative plan (if draft)');
    expect(payload).toContain('Draft simulation');
    expect(payload).toContain('Target');
    expect(payload).not.toContain('Network chain');
    expect(payload).toContain('2025-04');
    expect(payload).toContain('"showlegend":false');
    expect(payload).toContain('"scrollZoom":true');
    // Match Sanitization Store impact: auto Y ticks (no forced 1pp grid).
    expect(payload).not.toContain('"dtick":1');
    expect(screen.getByTestId('store-evaluation-legend')).toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-draft')).toHaveTextContent(/Draft simulation/i);
  });
});
