import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../schemas/api';
import { appTheme } from '../theme';
import { KpiCards } from './KpiCards';

const processResult = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [],
  high_store_months: [],
  store_impact_series: [],
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
  it('renders verdict strip with KPIs and run telemetry', () => {
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
});
