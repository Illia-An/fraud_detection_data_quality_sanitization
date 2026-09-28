import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import { PlannerContextStrip } from './PlannerContextStrip';

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 1,
  rows: [{ store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 90 }],
};

const draftPlan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 73,
  feasible: true,
  chain_trajectory: [],
  projections: [],
};

describe('PlannerContextStrip', () => {
  it('renders baseline, glance badges, and network slack bar', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <PlannerContextStrip
          panel={panel}
          processResult={null}
          baselineReady
          draftPlan={draftPlan}
          horizonMonths={6}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('planner-context-strip')).toBeInTheDocument();
    expect(screen.getByText(/Baseline: Cleansed Q10012/i)).toBeInTheDocument();
    expect(screen.getByText('Horizon: 6 mo')).toBeInTheDocument();
    expect(screen.getByText('Target: 75.0%')).toBeInTheDocument();
    expect(screen.getByText('Status: Projected 73.0%')).toBeInTheDocument();
    expect(screen.getByText(/Network slack/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 pp slack to target/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Network slack progress/i)).toBeInTheDocument();
  });
});
