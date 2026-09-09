import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { PipelineRunPanel } from './PipelineRunPanel';
import { defaultPipelineConfig } from '../schemas/api';
import { useUiStore } from '../store/uiStore';

vi.mock('../api/hooks', () => ({
  useProcess: vi.fn(),
}));

import { useProcess } from '../api/hooks';

const mockUseProcess = vi.mocked(useProcess);

const sampleRow = {
  ParticipateNumber: 'p-1',
  Question_ID: 10012,
  Answer_Value: 5,
  PrintStore: 1,
  Year: 2025,
  Month: 1,
};

const smallMeta = {
  preset: 'small',
  row_count: 1,
  store_count: 1,
  month_count: 1,
  description: 'test',
};

const dbMeta = {
  preset: 'db',
  row_count: 50,
  store_count: 4,
  month_count: 3,
  description: 'from db',
};

const processResult = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [
    {
      step_name: '1_tier1',
      rows_in: 95,
      rows_out: 90,
      rows_dropped: 5,
      top_box_rate_pct: 84.0,
      drop_reasons: {},
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
  meta: {},
};

function renderPanel() {
  return render(
    <ThemeProvider theme={appTheme}>
      <PipelineRunPanel config={defaultPipelineConfig} />
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
    mockUseProcess.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);
  });

  it('shows info when no survey rows loaded', () => {
    renderPanel();
    expect(
      screen.getByText('Waiting for survey data (database sample or synthetic preset).'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run pipeline' })).toBeDisabled();
  });

  it('auto-runs pipeline when survey rows are loaded', async () => {
    const mutate = vi.fn();
    const reset = vi.fn();
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset,
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.getState().setSurveyData([sampleRow], smallMeta, 'small');
    renderPanel();

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        source: 'inline',
        rows: [sampleRow],
        config: defaultPipelineConfig,
      });
    });
  });

  it('auto-runs db source without shipping rows', async () => {
    const mutate = vi.fn();
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.getState().setSurveyData([], dbMeta, 'db');
    renderPanel();

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        source: 'db',
        rows: [],
        config: defaultPipelineConfig,
      });
    });
  });

  it('runs pipeline and shows KPI cards', async () => {
    const mutate = vi.fn();
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: processResult,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.getState().setSurveyData([sampleRow], smallMeta, 'small');
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(mutate).toHaveBeenCalledWith({
      source: 'inline',
      rows: [sampleRow],
      config: defaultPipelineConfig,
    });

    await waitFor(() => {
      expect(screen.getByText('85.50%')).toBeInTheDocument();
      expect(screen.getByText('-3.40 pp')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pipeline steps/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Flagged store×months/i })).toBeInTheDocument();
    });
  });

  it('shows error state', () => {
    mockUseProcess.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error('Pipeline execution failed'),
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.getState().setSurveyData([sampleRow], smallMeta, 'small');
    renderPanel();

    expect(screen.getByText('Pipeline execution failed')).toBeInTheDocument();
  });
});
