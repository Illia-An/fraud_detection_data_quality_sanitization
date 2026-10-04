import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import { StoreAuditDrawer } from './StoreAuditDrawer';

vi.mock('react-plotly.js', () => ({
  default: () => <div data-testid="store-hero-plotly-mock" />,
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

function renderDrawer(overrides?: {
  onStoreChange?: (id: number) => void;
  onApplyPlan?: (next: FivePercentPlan) => void;
  plan?: FivePercentPlan;
}) {
  const onStoreChange = overrides?.onStoreChange ?? vi.fn();
  const onApplyPlan = overrides?.onApplyPlan ?? vi.fn();
  return {
    onApplyPlan,
    ...render(
      <ThemeProvider theme={appTheme}>
        <StoreAuditDrawer
          open
          storeId={10}
          plan={overrides?.plan ?? plan}
          panel={panel}
          insights={insights}
          processResult={null}
          maxMonthlyImprove={4}
          onClose={vi.fn()}
          onStoreChange={onStoreChange}
          onApplyPlan={onApplyPlan}
        />
      </ThemeProvider>,
    ),
  };
}

describe('StoreAuditDrawer', () => {
  it('shows store evaluation hero, estimate funnel, and audit icons', async () => {
    renderDrawer();

    expect(screen.getByTestId('store-inspect-dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Inspect/i)).toBeInTheDocument();
    expect(screen.getByTestId('inspect-store-select')).toBeInTheDocument();
    expect(screen.getByLabelText(/Select store/i)).toHaveValue('Store 10');
    expect(screen.getByTestId('inspect-sandbox-warn')).toBeInTheDocument();
    expect(screen.getByLabelText(/Session sandbox what-if/i)).toBeInTheDocument();
    expect(screen.getByTestId('store-hero-evaluation-chart')).toBeInTheDocument();
    expect(screen.getByText(/Store evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/as-of gap/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('store-hero-plotly-mock')).toBeInTheDocument();
    });
    expect(screen.getByTestId('inspect-sandbox-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-sandbox-panel')).toBeInTheDocument();
    expect(screen.getByText(/Estimate vs actual/i)).toBeInTheDocument();
    expect(screen.getByText(/Last month only/i)).toBeInTheDocument();
    // Collapsed by default — expand to reach table / metrics.
    fireEvent.click(screen.getByRole('button', { name: /Estimate vs actual/i }));
    await waitFor(() => {
      expect(screen.getByText('estimate')).toBeInTheDocument();
    });
    expect(screen.getByText('actual')).toBeInTheDocument();
    expect(screen.getByText('difference')).toBeInTheDocument();
    expect(screen.getByText('Taken')).toBeInTheDocument();
    expect(screen.getByText('Distributed')).toBeInTheDocument();
    expect(screen.getByText('Leftover')).toBeInTheDocument();
    expect(screen.queryByTestId('inspect-history-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('inspect-audit-info')).toBeInTheDocument();
    expect(screen.getByLabelText(/Rule audit/i)).toBeInTheDocument();
  });

  it('switches store via header autocomplete', async () => {
    const onStoreChange = vi.fn();
    renderDrawer({ onStoreChange });

    const input = screen.getByLabelText(/Select store/i);
    fireEvent.mouseDown(input);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Store 20' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: 'Store 20' }));
    expect(onStoreChange).toHaveBeenCalledWith(20);
  });

  it('recalculates Taken/pool and opens pool dialog on demand', async () => {
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Estimate vs actual/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Last month estimate/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/Last month estimate/i);
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.click(screen.getByTestId('inspect-recalculate'));

    // taken = 70 − 72 = −2
    expect(screen.getAllByText('-2.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('inspect-reset')).not.toBeDisabled();
    expect(screen.getByTestId('inspect-apply')).not.toBeDisabled();
    expect(screen.queryByTestId('inspect-pool-dialog')).not.toBeInTheDocument();

    const viewPool = screen.getByTestId('inspect-view-pool');
    expect(viewPool).not.toBeDisabled();
    fireEvent.click(viewPool);

    await waitFor(() => {
      expect(screen.getByTestId('inspect-pool-dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Counterpart pool/i)).toBeInTheDocument();
    expect(screen.getByText('selected')).toBeInTheDocument();
    // Plan prop projections unchanged until Apply
    expect(plan.projections[0].months[1].score).toBe(72);
  });

  it('Apply to draft commits even-split; Reset preview clears what-if only', async () => {
    const onApplyPlan = vi.fn();
    renderDrawer({ onApplyPlan });

    fireEvent.click(screen.getByRole('button', { name: /Estimate vs actual/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Last month estimate/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Last month estimate/i), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByTestId('inspect-recalculate'));
    expect(screen.getByTestId('inspect-reset')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('inspect-apply'));

    expect(onApplyPlan).toHaveBeenCalledTimes(1);
    const applied = onApplyPlan.mock.calls[0][0] as FivePercentPlan;
    expect(applied.projections.find((p) => p.store_id === 10)?.months[1].score).toBeCloseTo(
      70,
      5,
    );
    expect(applied.projections.find((p) => p.store_id === 20)?.months[1].score).toBeGreaterThan(
      76,
    );
    // After Apply, preview is cleared — session revert is on Planner.
    expect(screen.getByTestId('inspect-reset')).toBeDisabled();
    expect(screen.getByTestId('inspect-apply')).toBeDisabled();
    expect(screen.getByTestId('inspect-apply-toast')).toBeInTheDocument();
    expect(screen.getByText(/Applied to draft/i)).toBeInTheDocument();
  });

  it('Reset preview restores estimate input without calling onApplyPlan', async () => {
    const onApplyPlan = vi.fn();
    renderDrawer({ onApplyPlan });

    fireEvent.click(screen.getByRole('button', { name: /Estimate vs actual/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Last month estimate/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Last month estimate/i), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByTestId('inspect-recalculate'));
    fireEvent.click(screen.getByTestId('inspect-reset'));

    expect(onApplyPlan).not.toHaveBeenCalled();
    const estimate = screen.getByLabelText(/Last month estimate/i) as HTMLInputElement;
    expect(Number(estimate.value)).toBeCloseTo(72, 5);
    expect(screen.getByTestId('inspect-reset')).toBeDisabled();
  });
});
