import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import type { ProcessResponse } from '../schemas/api';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';
import { appTheme } from '../theme';
import { PlannerPage } from './PlannerPage';

const sampleResult: ProcessResponse = {
  baseline_top_box_pct: 80,
  final_top_box_pct: 75,
  network_delta_pp: -5,
  steps: [],
  high_store_months: [],
  store_impact_series: [
    {
      store_id: 10,
      year: 2025,
      month: 3,
      period_label: '2025-03',
      actual_five_pct: 80,
      after_tier1_five_pct: 78,
      after_tier2_five_pct: 76,
      after_tier3_five_pct: 75,
      after_tier4_five_pct: 74,
      actual_volume: 100,
      final_volume: 90,
      rows_dropped: 10,
    },
    {
      store_id: 20,
      year: 2025,
      month: 3,
      period_label: '2025-03',
      actual_five_pct: 70,
      after_tier4_five_pct: 68,
      actual_volume: 80,
      final_volume: 70,
      rows_dropped: 10,
    },
  ],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 1,
    peak_memory_mb: 1,
    rows_scanned: 10,
    period_start: '2025-01-01',
    period_end: null,
  },
};

function renderPlanner() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          <PlannerPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('PlannerPage Phase A', () => {
  beforeEach(() => {
    useUiStore.setState({ processResult: null });
    usePlannerScenarioStore.getState().clearAll();
  });

  it('blocks Run when sanitization baseline is missing', () => {
    renderPlanner();
    expect(screen.getByText(/Run Sanitization first/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run simulation/i })).toBeDisabled();
  });

  it('shows parameters and enables Run when panel has reference stores', () => {
    useUiStore.setState({ processResult: sampleResult });
    renderPlanner();
    expect(screen.getByRole('button', { name: /Run simulation/i })).toBeEnabled();
    expect(screen.getByLabelText(/Target/i)).toBeInTheDocument();
    expect(screen.getByText(/Set levers and Run simulation/i)).toBeInTheDocument();
  });
});

describe('PlannerPage controls rail', () => {
  beforeEach(() => {
    useUiStore.setState({ processResult: sampleResult });
    usePlannerScenarioStore.getState().clearAll();
  });

  it('collapses and expands the controls rail without unmounting controls', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPlanner();

    const rail = screen.getByTestId('controls-rail');
    expect(rail).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText(/Allocation levers/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse controls' }));

    expect(rail).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Expand controls' })).toBeInTheDocument();
    // Keep-mounted: form stays in the tree (hidden via CSS on md).
    expect(screen.getByText(/Allocation levers/i)).toBeInTheDocument();
    expect(screen.queryByTestId('collapsed-run')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('collapsed-run')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand controls' }));

    expect(rail).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText(/Allocation levers/i)).toBeInTheDocument();
    expect(screen.queryByTestId('collapsed-run')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
