import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { PipelineRunPanel } from './PipelineRunPanel';
import { defaultPipelineConfig, type ProcessResponse } from '../schemas/api';
import type { PipelineRunner } from '../hooks/usePipelineRunner';
import { useUiStore } from '../store/uiStore';

const processResult: ProcessResponse = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [
    {
      step_name: 'actual',
      rows_in: 100,
      rows_out: 95,
      rows_dropped: 5,
      top_box_pct: 85.5,
    },
    {
      step_name: 'tier1',
      rows_in: 95,
      rows_out: 90,
      rows_dropped: 5,
      top_box_pct: 84.0,
    },
    {
      step_name: 'tier2',
      rows_in: 90,
      rows_out: 88,
      rows_dropped: 2,
      top_box_pct: 82.1,
    },
  ],
  high_store_months: [
    {
      store_id: 1,
      year: 2025,
      month: 1,
      volume: 40,
      five_pct: 95.0,
      z: 2.5,
      flagged: true,
    },
  ],
  store_impact_series: [],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 12.5,
    peak_memory_mb: 0.5,
    rows_scanned: 100,
  },
};

function makeRunner(overrides: Partial<PipelineRunner> = {}): PipelineRunner {
  return {
    canRun: true,
    noData: false,
    isPending: false,
    isError: false,
    error: null,
    displayResult: null,
    handleRun: vi.fn(),
    ...overrides,
  };
}

function renderPanel(runner: PipelineRunner) {
  return render(
    <ThemeProvider theme={appTheme}>
      <PipelineRunPanel runner={runner} />
    </ThemeProvider>,
  );
}

describe('PipelineRunPanel', () => {
  beforeEach(() => {
    useUiStore.setState({
      surveyRows: [],
      processResult: null,
      sampleMeta: null,
      sampleGeneration: 0,
      lastPreset: 'db',
      selectedStoreId: null,
    });
  });

  it('shows info when no survey rows loaded', () => {
    renderPanel(makeRunner({ canRun: false, noData: true, displayResult: null }));
    expect(
      screen.getByText('Waiting for survey data (database sample or synthetic preset).'),
    ).toBeInTheDocument();
  });

  it('shows KPI cards and audit sections when result is present', async () => {
    renderPanel(makeRunner({ displayResult: processResult }));

    await waitFor(() => {
      expect(screen.getAllByText('85.50%').length).toBeGreaterThan(0);
      expect(screen.getByText('-3.40 pp')).toBeInTheDocument();
      expect(screen.getByTestId('explore-split')).toBeInTheDocument();
      expect(screen.getByTestId('pipeline-steps-overlay')).toBeInTheDocument();
      expect(screen.getByText('Flagged store×months')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pipeline steps funnel/i })).toBeInTheDocument();
      expect(screen.getByText(/Largest Δ vs prev:/i)).toBeInTheDocument();
    });
  });

  it('shows error state', () => {
    renderPanel(
      makeRunner({
        isError: true,
        error: new Error('Pipeline execution failed'),
        displayResult: null,
      }),
    );

    expect(screen.getByText('Pipeline execution failed')).toBeInTheDocument();
  });

  it('shows running state', () => {
    renderPanel(makeRunner({ isPending: true, displayResult: null }));
    expect(screen.getByText('Running scenario…')).toBeInTheDocument();
  });
});
