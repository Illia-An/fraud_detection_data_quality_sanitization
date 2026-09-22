import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import { appTheme } from '../theme';
import { useUiStore } from '../store/uiStore';
import { KpiCards } from './KpiCards';

const processResult = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [],
  high_store_months: [],
  store_impact_series: [
    {
      store_id: 1,
      year: 2025,
      month: 1,
      period_label: '2025-01',
      actual_five_pct: 90,
      after_tier4_five_pct: 80,
      actual_volume: 100,
      final_volume: 90,
      rows_dropped: 10,
    },
    {
      store_id: 1,
      year: 2025,
      month: 2,
      period_label: '2025-02',
      actual_five_pct: 70,
      after_tier4_five_pct: 60,
      actual_volume: 100,
      final_volume: 90,
      rows_dropped: 10,
    },
  ],
  echo_config: defaultPipelineConfig,
  meta: {
    execution_time_ms: 12.5,
    peak_memory_mb: 0.5,
    rows_scanned: 100,
    db_query_a_time_ms: 4.2,
    db_query_b_time_ms: 8.1,
  },
};

describe('KpiCards', () => {
  beforeEach(() => {
    useUiStore.setState({
      chartScope: 'network',
      selectedStoreId: 1,
    });
  });

  it('renders verdict strip with network KPIs and run telemetry', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <KpiCards result={processResult} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('kpi-telemetry-strip')).toBeInTheDocument();
    expect(screen.getByText('Baseline 5%')).toBeInTheDocument();
    expect(screen.getByText('85.50%')).toBeInTheDocument();
    expect(screen.getByText('Final 5%')).toBeInTheDocument();
    expect(screen.getByText('82.10%')).toBeInTheDocument();
    expect(screen.getByText('Network delta')).toBeInTheDocument();
    expect(screen.getByText('-3.40 pp')).toBeInTheDocument();
    expect(screen.getByText('Run telemetry')).toBeInTheDocument();
    expect(screen.getByTestId('run-telemetry-scroll')).toBeInTheDocument();
    expect(screen.getByText('12.5 ms')).toBeInTheDocument();
    expect(screen.getByText('0.50 MB')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/A 4\.2 ms · B 8\.1 ms/)).toBeInTheDocument();
    expect(screen.queryByText('Tier 3 entities')).not.toBeInTheDocument();
    expect(screen.queryByText('Pipeline telemetry')).not.toBeInTheDocument();
  });

  it('colors negative network delta as error', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <KpiCards result={processResult} />
      </ThemeProvider>,
    );

    expect(screen.getByText('-3.40 pp')).toHaveStyle({ color: 'rgb(211, 47, 47)' });
  });

  it('shows store-scoped KPIs when chart scope is Store', () => {
    useUiStore.setState({ chartScope: 'store', selectedStoreId: 1 });
    render(
      <ThemeProvider theme={appTheme}>
        <KpiCards result={processResult} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Store 1 baseline 5%')).toBeInTheDocument();
    expect(screen.getByText('80.00%')).toBeInTheDocument(); // (90+70)/2
    expect(screen.getByText('Store 1 final 5%')).toBeInTheDocument();
    expect(screen.getByText('70.00%')).toBeInTheDocument(); // (80+60)/2
    expect(screen.getByText('Store 1 delta')).toBeInTheDocument();
    expect(screen.getByText('-10.00 pp')).toBeInTheDocument();
  });
});
