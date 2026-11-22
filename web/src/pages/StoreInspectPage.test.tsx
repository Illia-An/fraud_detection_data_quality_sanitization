import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import type { ProcessResponse } from '../schemas/api';
import type { FivePercentPlan } from '../schemas/plan';
import { usePlannerRuntimeStore } from '../store/plannerRuntimeStore';
import { usePlannerScenarioStore } from '../store/plannerScenarioStore';
import { useUiStore } from '../store/uiStore';
import { appTheme } from '../theme';
import { StoreInspectPage } from './StoreInspectPage';

const draft: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [{ year: 2025, month: 4, score: 71 }],
  projections: [
    {
      store_id: 10,
      months: [{ year: 2025, month: 4, score: 68 }],
    },
  ],
};

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
      month: 4,
      period_label: '2025-04',
      actual_five_pct: 70,
      after_tier4_five_pct: 68,
      actual_volume: 100,
      final_volume: 90,
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

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/planner" element={<div data-testid="planner-home">planner</div>} />
            <Route path="/planner/store/:storeId" element={<StoreInspectPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('StoreInspectPage', () => {
  beforeEach(() => {
    usePlannerScenarioStore.setState({
      draftPlan: draft,
      approvedPlan: draft,
      isDirty: false,
      selectedStoreId: null,
      activePlanVersionId: null,
    });
    usePlannerRuntimeStore.getState().clear();
    useUiStore.setState({ processResult: sampleResult });
  });

  it('renders store inspect with glance and opens estimate sandbox dialog', () => {
    renderAt('/planner/store/10');
    expect(screen.getByTestId('store-inspect-page')).toBeInTheDocument();
    expect(screen.getByTestId('store-inspect-back')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-store-glance')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-open-sandbox')).toBeInTheDocument();
    expect(screen.queryByTestId('inspect-sandbox-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('store-inspect-need-sim')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('inspect-open-sandbox'));
    expect(screen.getByTestId('inspect-sandbox-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-sandbox-panel')).toBeInTheDocument();
  });

  it('redirects to planner when there is no draft', () => {
    usePlannerScenarioStore.setState({ draftPlan: null, approvedPlan: null });
    renderAt('/planner/store/10');
    expect(screen.getByTestId('planner-home')).toBeInTheDocument();
  });
});
