import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { StoreImpactChart } from './StoreImpactChart';
import { useUiStore } from '../store/uiStore';

vi.mock('react-plotly.js', () => ({
  default: ({
    onHover,
    onUnhover,
    data,
  }: {
    onHover?: (event: { points: { curveNumber: number }[] }) => void;
    onUnhover?: () => void;
    data?: { opacity?: number }[];
  }) => (
    <div data-testid="plotly-chart">
      <button type="button" data-testid="plotly-hover-tier1" onClick={() => onHover?.({ points: [{ curveNumber: 1 }] })}>
        hover-tier1
      </button>
      <button type="button" data-testid="plotly-unhover" onClick={() => onUnhover?.()}>
        unhover
      </button>
      <span data-testid="plotly-opacities">
        {(data ?? []).map((trace) => trace.opacity ?? 1).join(',')}
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
});
