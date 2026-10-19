import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { useTtsPipelineRunner } from './useTtsPipelineRunner';
import { defaultTtsPipelineConfig } from '../schemas/tts';
import { useTtsUiStore } from '../store/ttsUiStore';

vi.mock('../api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/hooks')>();
  return {
    ...actual,
    useProcessTts: vi.fn(),
  };
});

import { useProcessTts } from '../api/hooks';

const mockUseProcessTts = vi.mocked(useProcessTts);

const sampleRow = {
  StoreIndex: 1,
  SaleDate: '2026-09-01',
  WeborderID: 'w1',
  UpDatetime: '2026-09-01T10:00:00',
  BumpDateTime: '2026-09-01T10:03:00',
};

const smallMeta = {
  preset: 'small',
  row_count: 1,
  store_count: 1,
  month_count: 1,
  description: 'test',
};

function RunnerProbe({
  onReady,
}: {
  onReady: (runner: ReturnType<typeof useTtsPipelineRunner>) => void;
}) {
  const runner = useTtsPipelineRunner(defaultTtsPipelineConfig);
  onReady(runner);
  return (
    <button
      type="button"
      onClick={() => runner.handleRun()}
      disabled={runner.noData || runner.isPending}
    >
      Run TTS
    </button>
  );
}

function renderRunner(
  onReady: (runner: ReturnType<typeof useTtsPipelineRunner>) => void = () =>
    undefined,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <RunnerProbe onReady={onReady} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('useTtsPipelineRunner', () => {
  beforeEach(() => {
    useTtsUiStore.setState({
      bumpRows: [],
      processResult: null,
      sampleMeta: null,
      sampleGeneration: 0,
      sampleDataKey: null,
      lastPreset: 'small',
      selectedStoreId: null,
      periodPreset: 'from_2025',
      customFromDate: '2025-01-01',
      customToDate: '',
      chartScope: 'network',
    });
  });

  it('stays disabled without sample data', () => {
    mockUseProcessTts.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcessTts>);

    renderRunner();
    expect(screen.getByRole('button', { name: 'Run TTS' })).toBeDisabled();
  });

  it('posts inline request when synthetic rows are loaded', async () => {
    const mutate = vi.fn();
    mockUseProcessTts.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcessTts>);

    useTtsUiStore.getState().setSampleData([sampleRow], smallMeta, 'small', 1);

    renderRunner();
    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      source: 'inline',
      rows: [sampleRow],
      config: { tts_min_sec: 30, order_agg: 'none' },
    });
  });

  it('posts db request with period on manual Run', async () => {
    const mutate = vi.fn();
    mockUseProcessTts.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcessTts>);

    useTtsUiStore.getState().markDbReady({
      preset: 'db',
      row_count: 1,
      store_count: 0,
      month_count: 0,
      description: 'db',
    });

    renderRunner();
    fireEvent.click(screen.getByRole('button', { name: 'Run TTS' }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      source: 'db',
      rows: [],
      from_date: '2025-01-01',
    });
  });
});
