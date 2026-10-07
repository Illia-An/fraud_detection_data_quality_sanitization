import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProcess, useSample, useSampleDb } from '../api/hooks';
import { appTheme } from '../theme';
import { SanitizationPage } from './SanitizationPage';
import { useUiStore } from '../store/uiStore';

vi.mock('../api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/hooks')>();
  return {
    ...actual,
    useProcess: vi.fn(),
    useSample: vi.fn(),
    useSampleDb: vi.fn(),
  };
});

const mockUseProcess = vi.mocked(useProcess);
const mockUseSample = vi.mocked(useSample);
const mockUseSampleDb = vi.mocked(useSampleDb);

const sampleRow = {
  ParticipateNumber: 'p-1',
  Question_ID: 10012,
  Answer_Value: 5,
  PrintStore: 1,
  Year: 2025,
  Month: 1,
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

function idleDbQuery() {
  return {
    data: undefined,
    dataUpdatedAt: 0,
    isFetching: false,
    isError: false,
    error: null,
    isSuccess: false,
    refetch: vi.fn(),
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          <SanitizationPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('SanitizationPage controls rail', () => {
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mutate = vi.fn((_request, options?: { onSuccess?: (data: unknown) => void }) => {
      options?.onSuccess?.({
        baseline_top_box_pct: 80,
        final_top_box_pct: 75,
        network_delta_pp: -5,
        steps: [],
        high_store_months: [],
        store_impact_series: [],
        echo_config: {},
        meta: { execution_time_ms: 1, peak_memory_mb: 0.1, rows_scanned: 1 },
      });
    });
    mockUseProcess.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useProcess>);

    mockUseSample.mockReturnValue({
      data: samplePayload,
      dataUpdatedAt: 1_700_000_000_000,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSample>);

    mockUseSampleDb.mockReturnValue(idleDbQuery() as unknown as ReturnType<typeof useSampleDb>);

    useUiStore.setState({
      lastPreset: 'small',
      surveyRows: [],
      sampleMeta: null,
      processResult: null,
      sampleGeneration: 0,
      sampleDataKey: null,
    });
  });

  it('collapses and expands the controls rail without unmounting controls', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    await waitFor(() => {
      expect(useUiStore.getState().sampleGeneration).toBeGreaterThan(0);
    });

    const rail = screen.getByTestId('controls-rail');
    expect(rail).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('Sanitization controls')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse controls' }));

    expect(rail).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Expand controls' })).toBeInTheDocument();
    // Keep-mounted: form stays in the tree (hidden via CSS on md).
    expect(screen.getByText('Sanitization controls')).toBeInTheDocument();
    // Compact Play is deferred to avoid ghost-click on the collapse control.
    expect(screen.queryByTestId('collapsed-run')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('collapsed-run')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand controls' }));

    expect(rail).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('Sanitization controls')).toBeInTheDocument();
    expect(screen.queryByTestId('collapsed-run')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not auto-run pipeline when collapsing or expanding controls', async () => {
    renderPage();

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    mutate.mockClear();
    const generationBefore = useUiStore.getState().sampleGeneration;
    expect(generationBefore).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand controls' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(useUiStore.getState().sampleGeneration).toBe(generationBefore);
  });

  it('lists scenario packs above manual tiers and runs pack recipe', async () => {
    renderPage();

    await waitFor(() => {
      expect(useUiStore.getState().sampleGeneration).toBeGreaterThan(0);
    });
    mutate.mockClear();

    expect(screen.getByTestId('sanitization-scenario-packs-panel')).toBeInTheDocument();
    expect(screen.getByText(/Choose a question/i)).toBeInTheDocument();
    expect(screen.getByText('Manual tiers')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sanitization-pack-apply-with_store_month'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    const request = mutate.mock.calls.at(-1)?.[0];
    expect(request.config.tier4_enabled).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId('sanitization-active-scenario')).toHaveTextContent(
        /With store×month/i,
      );
    });
    expect(screen.getByTestId('sanitization-undo-scenario')).toBeInTheDocument();
    expect(screen.getByTestId('sanitization-manual-run')).toHaveClass('MuiButton-outlined');
  });

  it('active scenario chip scrolls to question packs', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderPage();

    await waitFor(() => {
      expect(useUiStore.getState().sampleGeneration).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId('sanitization-pack-apply-standard_spec'));
    await waitFor(() => {
      expect(screen.getByTestId('sanitization-active-scenario')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('sanitization-active-scenario'));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('undo restores previous config and clears one-level undo stack', async () => {
    renderPage();

    await waitFor(() => {
      expect(useUiStore.getState().sampleGeneration).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId('sanitization-pack-apply-with_store_month'));
    await waitFor(() => {
      expect(screen.getByTestId('sanitization-active-scenario')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('sanitization-pack-apply-core_only'));
    await waitFor(() => {
      expect(screen.getByTestId('sanitization-active-scenario')).toHaveTextContent(
        /Blacklist \+ frequency/i,
      );
    });

    fireEvent.click(screen.getByTestId('sanitization-undo-scenario'));

    await waitFor(() => {
      expect(screen.getByTestId('sanitization-active-scenario')).toHaveTextContent(
        /With store×month/i,
      );
    });
    expect(screen.queryByTestId('sanitization-undo-scenario')).not.toBeInTheDocument();
  });
});
