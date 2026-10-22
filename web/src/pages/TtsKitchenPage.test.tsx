import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useKitchenBeforeAfter } from '../api/hooks';
import type { KitchenBeforeAfter } from '../schemas/ttsKitchen';
import { appTheme } from '../theme';
import { TtsKitchenPage } from './TtsKitchenPage';

vi.mock('react-plotly.js', () => ({
  default: () => <div data-testid="kitchen-plotly" />,
}));

vi.mock('../api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/hooks')>();
  return {
    ...actual,
    useKitchenBeforeAfter: vi.fn(),
  };
});

const mockUseKitchenBeforeAfter = vi.mocked(useKitchenBeforeAfter);

const level = {
  rows_in: 4,
  rows_dropped: 1,
  pct_dropped: 0.25,
  mean_before_sec: 100,
  mean_after_sec: 120,
  delta_sec: 20,
};

const result: KitchenBeforeAfter = {
  period_start: '2026-09-01',
  period_end: '2026-10-20',
  tts_min_sec: 30,
  network: level,
  network_months: [
    { year: 2026, month: 9, mean_before_sec: 90, mean_after_sec: 110 },
    { year: 2026, month: 10, mean_before_sec: 100, mean_after_sec: 120 },
  ],
  by_store: [
    {
      ...level,
      store_id: 105,
      months: [{ year: 2026, month: 9, mean_before_sec: 90, mean_after_sec: 110 }],
    },
  ],
  by_meit: [
    { ...level, meit_number: 10, rows_dropped: 1 },
    { ...level, meit_number: 20, rows_dropped: 5, rows_in: 8, pct_dropped: 0.625 },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          <TtsKitchenPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TtsKitchenPage', () => {
  let mutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mutate = vi.fn();
    mockUseKitchenBeforeAfter.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useKitchenBeforeAfter>);
  });

  it('shows the fixed window and locked settings', () => {
    renderPage();
    expect(screen.getByTestId('tts-kitchen-page')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Data source/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('combobox', { name: /Period/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('dbo.TargetsByMetrics_McKitiBump')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01 – 2026-10-20')).toBeInTheDocument();
    expect(screen.getByText(/Process window: 2026-09-01 → 2026-10-20/)).toBeInTheDocument();
    const minSec = screen.getByTestId('kitchen-min-sec');
    expect(minSec.tagName).toBe('INPUT');
    expect(minSec).toBeEnabled();
    expect(minSec).toHaveValue(30);
    expect(screen.getByText(/Exactly 30 seconds stay/)).toBeInTheDocument();
    expect(screen.getByTestId('kitchen-order-agg')).toHaveTextContent('none (bump rows)');
    expect(screen.getByTestId('kitchen-run')).toHaveClass('MuiButton-outlined');
    expect(screen.queryByTestId('tts-panel-handoff')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tts-panel-export-csv')).not.toBeInTheDocument();
  });

  it('runs the kitchen read from the button', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('kitchen-min-sec'), { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('kitchen-run'));
    fireEvent.click(screen.getByTestId('kitchen-reload'));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
    });
    expect(mutate).toHaveBeenNthCalledWith(1, 45);
    expect(mutate).toHaveBeenNthCalledWith(2, 45);
  });

  it('shows before and after, the code table, and the network steps', async () => {
    mockUseKitchenBeforeAfter.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      data: result,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useKitchenBeforeAfter>);

    renderPage();
    expect(screen.getByTestId('kitchen-kpi-cards')).toHaveTextContent('100.0 s');
    expect(screen.getByTestId('kitchen-kpi-cards')).toHaveTextContent('120.0 s');
    expect(screen.getByTestId('kitchen-kpi-cards')).toHaveTextContent('+20.0 s');
    expect(screen.getByTestId('kitchen-threshold-chip')).toHaveTextContent('≥ 30s');
    expect(screen.getByTestId('kitchen-kpi-cards')).toHaveTextContent('1 · 25.00%');
    expect(screen.getByTestId('kitchen-source-summary')).toHaveTextContent(
      'db · 4 positions · 1 stores · 2 months',
    );
    expect(screen.getByTestId('kitchen-impact-chart')).toHaveTextContent(
      '2026-09-01 – 2026-10-20',
    );
    expect(screen.queryByTestId('tts-panel-export-csv')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    const table = await screen.findByTestId('kitchen-code-table');
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveTextContent('20');
    expect(bodyRows[1]).toHaveTextContent('10');

    fireEvent.click(screen.getByText('Network before / after'));
    const steps = await screen.findByTestId('kitchen-steps-table');
    expect(steps).toHaveTextContent('Before');
    expect(steps).toHaveTextContent('After');
    expect(steps).toHaveTextContent('100.0 s');
    expect(steps).toHaveTextContent('120.0 s');
  });
});
