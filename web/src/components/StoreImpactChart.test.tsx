import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import { appTheme } from '../theme';
import { useUiStore } from '../store/uiStore';
import { StoreImpactChart } from './StoreImpactChart';

vi.mock('react-plotly.js', () => ({
  default: ({
    onHover,
    onUnhover,
    onLegendClick,
    data,
  }: {
    onHover?: (event: { points: { curveNumber: number }[] }) => void;
    onUnhover?: () => void;
    onLegendClick?: (event: { curveNumber: number }) => boolean | void;
    data?: { opacity?: number; visible?: boolean | 'legendonly'; name?: string }[];
  }) => (
    <div data-testid="plotly-chart">
      <button type="button" data-testid="plotly-hover-tier1" onClick={() => onHover?.({ points: [{ curveNumber: 1 }] })}>
        hover-tier1
      </button>
      <button type="button" data-testid="plotly-unhover" onClick={() => onUnhover?.()}>
        unhover
      </button>
      <button
        type="button"
        data-testid="plotly-legend-tier2"
        onClick={() => onLegendClick?.({ curveNumber: 2 })}
      >
        legend-tier2
      </button>
      <span data-testid="plotly-opacities">
        {(data ?? []).map((trace) => trace.opacity ?? 1).join(',')}
      </span>
      <span data-testid="plotly-visibility">
        {(data ?? []).map((trace) => String(trace.visible ?? true)).join(',')}
      </span>
    </div>
  ),
}));

const series = [
  {
    store_id: 1,
    year: 2025,
    month: 1,
    period_label: '2025-01',
    actual_five_pct: 95,
    after_tier1_five_pct: 88,
    after_tier2_five_pct: 85,
    actual_volume: 40,
    final_volume: 35,
    rows_dropped: 5,
  },
];

describe('StoreImpactChart', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedStoreId: 1,
      chartScope: 'store',
      chartTimeMode: 'timeline',
      highlightedPeriodLabel: null,
    });
  });

  it('renders store selector and lazy plotly chart', async () => {
    useUiStore.setState({ selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Store impact')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Store' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit to data' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await waitFor(() => {
      expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    });
    expect(screen.getByTestId('store-impact-legend')).toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-actual')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Actual.*Raw top-box/i),
    );
    expect(screen.getByText('Hover legend labels for short tips.')).toBeInTheDocument();
  });

  it('toggles Y-scale between Fit and 0–100%', () => {
    useUiStore.setState({ selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    const fullButton = screen.getByRole('button', { name: '0 to 100 percent' });
    fireEvent.click(fullButton);
    expect(fullButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Fit to data' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches chart scope Store ↔ Network and disables store select', () => {
    useUiStore.setState({ selectedStoreId: 1, chartScope: 'store', chartTimeMode: 'timeline' });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart
          series={[
            ...series,
            {
              store_id: 2,
              year: 2025,
              month: 1,
              period_label: '2025-01',
              actual_five_pct: 80,
              after_tier1_five_pct: 79,
              after_tier2_five_pct: 78,
              actual_volume: 30,
              final_volume: 29,
              rows_dropped: 1,
            },
          ]}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Store scope' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Network scope' }));
    expect(screen.getByRole('button', { name: 'Network scope' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useUiStore.getState().chartScope).toBe('network');
    expect(screen.getByText('Network aggregated')).toBeInTheDocument();
    expect(screen.getByLabelText('Store')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Store scope' }));
    expect(screen.getByRole('button', { name: 'Store scope' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText('Network aggregated')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Store')).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('toggles Timeline ↔ YoY time mode', () => {
    useUiStore.setState({ selectedStoreId: 1, chartScope: 'store', chartTimeMode: 'timeline' });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Year over year mode' }));
    expect(useUiStore.getState().chartTimeMode).toBe('yoy');
    expect(screen.getByText('YoY overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('store-impact-legend')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Timeline mode' }));
    expect(useUiStore.getState().chartTimeMode).toBe('timeline');
    expect(screen.queryByText('YoY overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('store-impact-legend')).toBeInTheDocument();
  });

  it('accepts highStoreMonths for Tier 4 overlays without crashing', async () => {
    useUiStore.setState({ selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart
          series={series}
          highStoreMonths={[
            {
              store_id: 1,
              year: 2025,
              month: 1,
              volume: 40,
              five_pct: 95,
              z: 2.5,
              flagged: true,
            },
          ]}
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    });
  });

  it('toggles Flagged overlay on/off next to Timeline/YoY when Tier 4 is enabled', async () => {
    useUiStore.setState({ selectedStoreId: 1, chartScope: 'store', chartTimeMode: 'timeline' });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart
          series={series}
          echoConfig={{
            ...defaultPipelineConfig,
            tier4_enabled: true,
          }}
          highStoreMonths={[
            {
              store_id: 1,
              year: 2025,
              month: 1,
              volume: 40,
              five_pct: 95,
              z: 2.5,
              flagged: true,
            },
          ]}
        />
      </ThemeProvider>,
    );

    const toggle = await screen.findByTestId('chart-flagged-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Year over year mode' }));
    expect(screen.queryByTestId('chart-flagged-toggle')).not.toBeInTheDocument();
  });

  it('dims sibling series on hover and restores on unhover', async () => {
    useUiStore.setState({ selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('plotly-hover-tier1'));
    await waitFor(() => {
      expect(screen.getByTestId('plotly-opacities').textContent).toBe('0.25,1,0.25,0.25,0.25');
    });

    fireEvent.click(screen.getByTestId('plotly-unhover'));
    await waitFor(() => {
      expect(screen.getByTestId('plotly-opacities').textContent).toBe('1,1,1,1,1');
    });
  });

  it('keeps legend-hidden traces off after hover focus refresh', async () => {
    useUiStore.setState({ selectedStoreId: 1, chartScope: 'store', chartTimeMode: 'timeline' });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('plotly-legend-tier2'));
    await waitFor(() => {
      expect(screen.getByTestId('plotly-visibility').textContent).toBe(
        'true,true,legendonly,true,true',
      );
    });

    fireEvent.click(screen.getByTestId('plotly-hover-tier1'));
    await waitFor(() => {
      expect(screen.getByTestId('plotly-visibility').textContent).toBe(
        'true,true,legendonly,true,true',
      );
      expect(screen.getByTestId('plotly-opacities').textContent).toBe('0.25,1,1,0.25,0.25');
    });
  });

  it('dispatches window resize when the plot container size changes', async () => {
    const observers: Array<{ callback: ResizeObserverCallback; el: Element }> = [];
    class MockResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.push({ callback, el: document.body });
      }
      observe(el: Element) {
        observers[observers.length - 1].el = el;
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const onResize = vi.fn();
    window.addEventListener('resize', onResize);

    useUiStore.setState({ selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <StoreImpactChart series={series} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('store-impact-plot-container')).toBeInTheDocument();
    });
    expect(observers.length).toBeGreaterThan(0);

    const entry = {
      target: observers[0].el,
      contentRect: { width: 900, height: 560 },
    } as unknown as ResizeObserverEntry;
    observers[0].callback([entry], {} as ResizeObserver);

    await waitFor(() => {
      expect(onResize).toHaveBeenCalled();
    });

    window.removeEventListener('resize', onResize);
    vi.unstubAllGlobals();
  });
});
