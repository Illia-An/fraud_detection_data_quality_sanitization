import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../theme';
import { StoreImpactChart } from './StoreImpactChart';
import { defaultPipelineConfig } from '../schemas/api';
import { useUiStore } from '../store/uiStore';

vi.mock('react-plotly.js', () => ({
  default: () => <div data-testid="plotly-chart" />,
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
        <StoreImpactChart series={series} config={defaultPipelineConfig} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Store impact')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Store' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    });
  });
});
