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
    { store_id: 10, year: 2025, month: 3, five_percent: 64, survey_volume: 90 },
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

    expect(
      screen.getByText((_, el) => el?.textContent === 'Behind Plan Only (1)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Behind 1')).toBeInTheDocument();
    expect(screen.getByText('Ahead 1')).toBeInTheDocument();

    // Open filter to assert each option has its own stable count (not tied to active filter).
    const filterSelect = () => screen.getByRole('combobox', { name: /^View$/i });
    fireEvent.mouseDown(filterSelect());
    expect(
      screen.getByRole('option', { name: 'Behind Plan Only (1)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ahead Plan Only (1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Top Gainers (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Top Laggards (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Stores (2)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Top Laggards (2)' }));
    expect(screen.getByText('Store #10')).toBeInTheDocument();
    // With only 2 stores, both appear in the slice; #10 (more behind) first.
    expect(screen.getByText('Store #20')).toBeInTheDocument();

    fireEvent.mouseDown(filterSelect());
    fireEvent.click(screen.getByRole('option', { name: 'Top Gainers (2)' }));
    expect(screen.getByText('Store #20')).toBeInTheDocument();
    expect(screen.getByText('Store #10')).toBeInTheDocument();

    fireEvent.mouseDown(filterSelect());
    fireEvent.click(screen.getByRole('option', { name: 'Ahead Plan Only (1)' }));
    expect(screen.getByText('Store #20')).toBeInTheDocument();
    expect(screen.queryByText('Store #10')).not.toBeInTheDocument();

    fireEvent.mouseDown(filterSelect());
    fireEvent.click(screen.getByRole('option', { name: 'Behind Plan Only (1)' }));
    expect(screen.getByText('Store #10')).toBeInTheDocument();
    expect(screen.queryByText('Store #20')).not.toBeInTheDocument();

    expect(screen.getByText('Fact As-Of')).toBeInTheDocument();
    expect(screen.getByText('Plan As-Of')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('MoM (pp)')).toBeInTheDocument();
    expect(screen.getByText('Baseline → End')).toBeInTheDocument();
    expect(screen.getByText('Behind streak')).toBeInTheDocument();
    expect(screen.getByText('Gap share')).toBeInTheDocument();
    expect(screen.getByText('Lift to end')).toBeInTheDocument();
    expect(screen.getByText('Error Budget Deficit')).toBeInTheDocument();
    expect(screen.getByText('66.0%')).toBeInTheDocument();
    expect(screen.getByText('68.0%')).toBeInTheDocument();
    expect(screen.getByText('−2.0 pp')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('+2.0 pp')).toBeInTheDocument();
    expect(screen.getByText('65.0% → 72.0%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('+6.0 pp')).toBeInTheDocument();
    expect(screen.getByText('Store #10')).toBeInTheDocument();
    expect(screen.queryByText('Store #20')).not.toBeInTheDocument();

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

    fireEvent.click(screen.getByText('Store #10'));
    expect(onInspect).toHaveBeenCalledWith(10);
  });
});
