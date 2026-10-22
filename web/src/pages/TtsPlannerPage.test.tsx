import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { useTtsPlannerScenarioStore } from '../store/ttsPlannerScenarioStore';
import { TtsPlannerPage } from './TtsPlannerPage';

const smallPanel = {
  preset: 'small',
  period_start: '2025-11-01',
  period_end: '2025-12-01',
  reference_year: 2025,
  reference_month: 12,
  row_count: 4,
  rows: [
    { store_id: 10, year: 2025, month: 11, tts: 4.4 },
    { store_id: 10, year: 2025, month: 12, tts: 4.2 },
    { store_id: 20, year: 2025, month: 11, tts: 4.0 },
    { store_id: 20, year: 2025, month: 12, tts: 3.8 },
  ],
};

const planResponse = {
  metrics: {
    tts: {
      metric_id: 'tts',
      unit: 'min',
      direction: 'lower_is_better',
      target: 3.5,
      current_chain: 4,
      required_change: 0.5,
      final_chain: 3.5,
      feasible: true,
      chain_trajectory: [
        { year: 2026, month: 1, score: 3.75 },
        { year: 2026, month: 2, score: 3.5 },
      ],
      projections: [
        {
          store_id: 10,
          months: [
            { year: 2026, month: 1, score: 3.9 },
            { year: 2026, month: 2, score: 3.5 },
          ],
        },
        {
          store_id: 20,
          months: [
            { year: 2026, month: 1, score: 3.6 },
            { year: 2026, month: 2, score: 3.5 },
          ],
        },
      ],
    },
  },
};

vi.mock('react-plotly.js', () => ({
  default: () => <div data-testid="tts-plotly" />,
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={appTheme}>
        <MemoryRouter>
          <TtsPlannerPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TtsPlannerPage shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useTtsPlannerScenarioStore.getState().clearAll();
    useTtsPlannerScenarioStore.getState().setPanel(null);
  });

  it('keeps Run closed until AP minutes arrive', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderPage();
    expect(screen.queryByRole('button', { name: /Load sample/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load from AP/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Sample$/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('tts-planner-need-baseline')).toHaveTextContent(
      /does not use kitchen sanitization/i,
    );
    expect(screen.queryByRole('link', { name: /Sanitization/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('tts-planner-run')).toBeDisabled();
    expect(screen.getByTestId('tts-planner-hero')).toBeInTheDocument();
    expect(screen.getByTestId('tts-planner-at-risk')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-packs')).toBeInTheDocument();
    expect(screen.getByTestId('store-mix-questions')).toBeInTheDocument();
    expect(screen.getAllByText(/Lower is better/i).length).toBeGreaterThan(0);
  });

  it('enables Run when the sample chain is above the target', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        text: async () =>
          JSON.stringify(String(url).includes('/plans-tts') ? planResponse : smallPanel),
      })),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tts-planner-current-chain')).toHaveTextContent('4.00 min');
    });
    expect(screen.getByLabelText(/Reference month/i)).toHaveTextContent('2025-12');
    expect(screen.getByText(/Improve ↓/i)).toBeInTheDocument();
    expect(screen.getByTestId('tts-planner-run')).toBeEnabled();

    fireEvent.click(screen.getByTestId('tts-planner-run'));
    await waitFor(() => {
      expect(screen.getByTestId('tts-planner-plan-summary')).toHaveTextContent('4.00 min → 3.50 min');
    });
    expect(screen.getByTestId('hero-evaluation-chart')).toBeInTheDocument();
    expect(screen.getByTestId('hero-required-mode')).toBeInTheDocument();
  });

  it('keeps the loaded baseline and plan when the page is opened again', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      text: async () =>
        JSON.stringify(String(url).includes('/plans-tts') ? planResponse : smallPanel),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const first = renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tts-planner-current-chain')).toHaveTextContent('4.00 min');
    });
    fireEvent.click(screen.getByTestId('tts-planner-run'));
    await waitFor(() => {
      expect(screen.getByTestId('tts-planner-plan-summary')).toHaveTextContent('4.00 min → 3.50 min');
    });

    const callsAfterRun = fetchMock.mock.calls.length;
    first.unmount();
    renderPage();

    expect(screen.getByTestId('tts-planner-current-chain')).toHaveTextContent('4.00 min');
    expect(screen.getByTestId('tts-planner-plan-summary')).toHaveTextContent('4.00 min → 3.50 min');
    expect(screen.queryByText(/Waiting for TTS minutes from AP/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsAfterRun);
  });

  it('runs a scenario, marks slower stores at risk, opens inspect, exports, then undoes', async () => {
    const requests: { priority_power?: number; max_monthly_improve?: number }[] = [];
    const createObjectURL = vi.fn(() => 'blob:tts-plan');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    const overlapPlan = {
      metrics: {
        tts: {
          ...planResponse.metrics.tts,
          chain_trajectory: [
            { year: 2025, month: 12, score: 3.95 },
            { year: 2026, month: 1, score: 3.5 },
          ],
          projections: [
            {
              store_id: 10,
              months: [
                { year: 2025, month: 12, score: 3.9 },
                { year: 2026, month: 1, score: 3.5 },
              ],
            },
            {
              store_id: 20,
              months: [
                { year: 2025, month: 12, score: 4.0 },
                { year: 2026, month: 1, score: 3.5 },
              ],
            },
          ],
        },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes('/plans-tts')) {
          requests.push(JSON.parse(String(init?.body)).params);
          return { ok: true, text: async () => JSON.stringify(overlapPlan) };
        }
        return { ok: true, text: async () => JSON.stringify(smallPanel) };
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('scenario-pack-apply-close_gap')).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId('scenario-pack-apply-close_gap'));
    await waitFor(() => {
      expect(screen.getByTestId('planner-active-answer')).toHaveTextContent(/Close the gap/i);
    });
    expect(requests[0]?.priority_power).toBe(1.5);
    expect(requests[0]?.max_monthly_improve).toBe(0.25);
    fireEvent.click(screen.getByText('At-Risk Exception List'));
    expect(screen.getByText('Store #10')).toBeInTheDocument();
    expect(screen.getByText('4.20 min')).toBeInTheDocument();
    expect(screen.queryByText('4.20%')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Store #10'));
    expect(screen.getByTestId('store-inspect-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('inspect-store-glance')).toHaveTextContent('4.20 min');
    expect(screen.getByTestId('inspect-audit-info')).toBeInTheDocument();

    const exportButton = screen.getByTestId('tts-planner-export');
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);
    expect(createObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('planner-undo-answer'));
    await waitFor(() => {
      expect(screen.queryByTestId('planner-active-answer')).not.toBeInTheDocument();
    });
  });

  it('loads the AP panel when the page opens', async () => {
    const apPanel = {
      ...smallPanel,
      preset: 'ap',
      source: 'ap',
      reference_year: 2026,
      reference_month: 10,
      row_count: 5,
      rows: [...smallPanel.rows, { store_id: 10, year: 2026, month: 10, tts: 9.9 }],
    };
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        const body = String(url).includes('/tts-kpi/ap') ? apPanel : smallPanel;
        return { ok: true, text: async () => JSON.stringify(body) };
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tts-planner-current-chain')).toHaveTextContent('4.00 min');
    });
    expect(screen.getByLabelText(/Reference month/i)).toHaveTextContent('2025-12');
    expect(urls.some((url) => url.includes('/tts-kpi/ap'))).toBe(true);
    expect(screen.queryByRole('button', { name: /Load sample/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load from AP/i })).not.toBeInTheDocument();
  });
});
