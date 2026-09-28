import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
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

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 4,
  row_count: 2,
  rows: [
    { store_id: 10, year: 2025, month: 4, five_percent: 66, survey_volume: 100 },
    { store_id: 20, year: 2025, month: 4, five_percent: 74, survey_volume: 80 },
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
  it('shows Behind Plan Only exceptions with as-of columns and Inspect', () => {
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
          panel={panel}
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

    expect(screen.getByText('Behind Plan Only')).toBeInTheDocument();
    expect(screen.getByText('Actual as-of')).toBeInTheDocument();
    expect(screen.getByText('Target as-of')).toBeInTheDocument();
    expect(screen.getByText('66.0')).toBeInTheDocument();
    expect(screen.getByText('68.0')).toBeInTheDocument();
    expect(screen.getByText('-2.0 pp')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inspect/i }));
    expect(onInspect).toHaveBeenCalledWith(10);
  });

  it('opens Inspect when clicking a table row', () => {
    const onInspect = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <AtRiskDeltaTable
          plan={plan}
          approvedPlan={null}
          baselineRows={[]}
          panel={panel}
          insights={insights}
          asOfOptions={[{ year: 2025, month: 4 }]}
          onAsOfChange={vi.fn()}
          onInspect={onInspect}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText('10'));
    expect(onInspect).toHaveBeenCalledWith(10);
  });
});
