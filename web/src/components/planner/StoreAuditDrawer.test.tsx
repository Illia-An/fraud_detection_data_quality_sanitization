import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import { StoreAuditDrawer } from './StoreAuditDrawer';

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
        { year: 2025, month: 4, score: 74 },
        { year: 2025, month: 5, score: 76 },
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
    { store_id: 20, year: 2025, month: 4, five_percent: 75, survey_volume: 80 },
  ],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 70.5, on_track: true },
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
      planned: 74,
      actual: 75,
      deviation: 1,
    },
  ],
  summary: { ahead: 1, on_plan: 0, behind: 1, insufficient: 0 },
};

function renderDrawer() {
  return render(
    <ThemeProvider theme={appTheme}>
      <StoreAuditDrawer
        open
        storeId={10}
        plan={plan}
        panel={panel}
        insights={insights}
        processResult={null}
        maxMonthlyImprove={4}
        onClose={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('StoreAuditDrawer', () => {
  it('shows plan vs actual lens, estimate table, and audit sections', () => {
    renderDrawer();

    expect(screen.getAllByText(/Store 10/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Plan vs actual/i)).toBeInTheDocument();
    expect(screen.getByText(/as of gap/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Plan vs actual gap/i })).toBeInTheDocument();
    expect(screen.getByText(/Estimate vs actual/i)).toBeInTheDocument();
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText('actual')).toBeInTheDocument();
    expect(screen.getByText('difference')).toBeInTheDocument();
    expect(screen.getByText('Taken')).toBeInTheDocument();
    expect(screen.getByText('Distributed')).toBeInTheDocument();
    expect(screen.getByText('Leftover')).toBeInTheDocument();
    expect(screen.getByText(/Cleansed history/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule audit/i)).toBeInTheDocument();
  });

  it('recalculates Taken/pool and keeps lens without mutating plan props', () => {
    renderDrawer();

    const input = screen.getByLabelText(/Last month estimate/i);
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: /Recalculate/i }));

    expect(screen.getByText(/Counterpart pool/i)).toBeInTheDocument();
    // taken = 70 − 72 = −2 (KPI + selected row)
    expect(screen.getAllByText('-2.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset draft/i })).toBeInTheDocument();
    // Plan prop projections unchanged (ephemeral draft only)
    expect(plan.projections[0].months[1].score).toBe(72);
  });
});
