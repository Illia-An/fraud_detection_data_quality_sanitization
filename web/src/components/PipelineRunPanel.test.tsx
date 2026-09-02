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

const processResult = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [],
  high_store_months: [],
  store_impact_series: [],
  entities_flagged_tier3: 0,
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
      lastPreset: 'small',
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
      screen.getByText('Load a sample preset before running the pipeline.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run pipeline' })).toBeDisabled();
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

    useUiStore.setState({ surveyRows: [sampleRow] });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));
    expect(mutate).toHaveBeenCalledWith({
      rows: [sampleRow],
      config: defaultPipelineConfig,
    });

    await waitFor(() => {
      expect(screen.getByText('85.50%')).toBeInTheDocument();
      expect(screen.getByText('-3.40 pp')).toBeInTheDocument();
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

    useUiStore.setState({ surveyRows: [sampleRow] });
    renderPanel();

    expect(screen.getByText('Pipeline execution failed')).toBeInTheDocument();
  });
});
