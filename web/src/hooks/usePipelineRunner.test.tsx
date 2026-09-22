import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { usePipelineRunner } from '../hooks/usePipelineRunner';
import { defaultPipelineConfig } from '../schemas/api';
import { useUiStore } from '../store/uiStore';

vi.mock('../api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/hooks')>();
  return {
    ...actual,
    useProcess: vi.fn(),
  };
});

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

function RunnerProbe({ onReady }: { onReady: (runner: ReturnType<typeof usePipelineRunner>) => void }) {
  const runner = usePipelineRunner(defaultPipelineConfig);
  onReady(runner);
  return (
    <button type="button" onClick={runner.handleRun} disabled={runner.noData || runner.isPending}>
      Run Scenario
    </button>
  );
}

function renderRunner(onReady: (runner: ReturnType<typeof usePipelineRunner>) => void = () => undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <RunnerProbe onReady={onReady} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('usePipelineRunner', () => {
  beforeEach(() => {
    useUiStore.setState({
      surveyRows: [],
      processResult: null,
      sampleMeta: null,
      sampleGeneration: 0,
      lastPreset: 'db',
      selectedStoreId: null,
      periodPreset: 'from_2025',
      customFromDate: '2025-01-01',
      customToDate: '',
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

  it('disables run when no data', () => {
    renderRunner();
    expect(screen.getByRole('button', { name: 'Run Scenario' })).toBeDisabled();
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
    renderRunner();

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
    renderRunner();

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        source: 'db',
        rows: [],
        config: defaultPipelineConfig,
        from_date: '2025-01-01',
      });
    });
  });

  it('manual db run uses selected period preset', async () => {
    const mutate = vi.fn();
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.setState({ periodPreset: 'ytd_2026' });
    useUiStore.getState().setSurveyData([], dbMeta, 'db');
    renderRunner();

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    mutate.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Run Scenario' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'db',
        from_date: '2026-01-01',
        to_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('manual run calls mutate', async () => {
    const mutate = vi.fn();
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    useUiStore.getState().setSurveyData([sampleRow], smallMeta, 'small');
    renderRunner();

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    mutate.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Run Scenario' }));
    expect(mutate).toHaveBeenCalledWith({
      source: 'inline',
      rows: [sampleRow],
      config: defaultPipelineConfig,
    });
  });
});
