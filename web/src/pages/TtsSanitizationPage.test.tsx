import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProcessTts, useTtsSample } from '../api/hooks';
import { appTheme } from '../theme';
import { TtsSanitizationPage } from './TtsSanitizationPage';
import { useTtsUiStore } from '../store/ttsUiStore';

vi.mock('../api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/hooks')>();
  return {
    ...actual,
    useProcessTts: vi.fn(),
    useTtsSample: vi.fn(),
  };
});

const mockUseProcessTts = vi.mocked(useProcessTts);
const mockUseTtsSample = vi.mocked(useTtsSample);

const sampleRow = {
  StoreIndex: 1,
  SaleDate: '2026-09-01',
  WeborderID: 'w1',
  UpDatetime: '2026-09-01T10:00:00',
  BumpDateTime: '2026-09-01T10:03:00',
};

const smallMeta = {
  preset: 'small' as const,
  row_count: 1,
  store_count: 1,
  month_count: 1,
  description: 'test',
};

const samplePayload = {
  preset: 'small',
  rows: [sampleRow],
  meta: smallMeta,
};

const processResult = {
  baseline_mean_tts_sec: 100,
  final_mean_tts_sec: 120,
  network_delta_sec: 20,
  steps: [
    {
      step_name: 'actual' as const,
      rows_in: 1,
      rows_out: 1,
      rows_dropped: 0,
      mean_tts_sec: 100,
      median_tts_sec: 100,
    },
    {
      step_name: 'ge30' as const,
      rows_in: 1,
      rows_out: 1,
      rows_dropped: 0,
      mean_tts_sec: 120,
      median_tts_sec: 120,
    },
  ],
  store_impact_series: [
    {
      store_id: 1,
      year: 2026,
      month: 9,
      actual_mean_tts_sec: 100,
      after_ge30_mean_tts_sec: 120,
      volume_before: 1,
      volume_after: 1,
    },
  ],
  echo_config: { tts_min_sec: 30, order_agg: 'none' as const },
  meta: { execution_time_ms: 1, peak_memory_mb: 0.1, rows_scanned: 1 },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          <TtsSanitizationPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TtsSanitizationPage', () => {
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useTtsUiStore.setState({
      bumpRows: [],
      processResult: null,
      sanitizedPanel: null,
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

    mutate = vi.fn((_request, options?: { onSuccess?: (data: unknown) => void }) => {
      options?.onSuccess?.(processResult);
    });
    mockUseProcessTts.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcessTts>);

    mockUseTtsSample.mockReturnValue({
      data: samplePayload,
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTtsSample>);
  });

  it('renders TTS controls and disables order_agg', async () => {
    renderPage();
    expect(screen.getByTestId('tts-sanitization-page')).toBeInTheDocument();
    expect(screen.getByTestId('tts-sample-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tts-config-form')).toBeInTheDocument();
    expect(screen.getByTestId('tts-run')).toBeInTheDocument();

    expect(screen.getByLabelText(/Order aggregation/i)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows KPI delta and panel handoff after a successful run', async () => {
    mockUseProcessTts.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: processResult,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcessTts>);

    // Simulate store panel build the same way useTtsPipelineRunner does on success.
    useTtsUiStore.getState().setProcessResult(processResult);

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tts-kpi-cards')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tts-kpi-cards')).toHaveTextContent('+20.0 s');
    expect(screen.getByTestId('tts-impact-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tts-panel-handoff')).toBeInTheDocument();
    expect(screen.getByTestId('tts-panel-chip')).toHaveTextContent('1 cells');
    expect(screen.getByTestId('tts-panel-export-csv')).toBeInTheDocument();
  });

  it('allows manual Run when sample is ready', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tts-run')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('tts-run'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
  });
});
