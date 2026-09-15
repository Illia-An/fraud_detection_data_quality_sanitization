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
    execution_time_ms: 10,
    peak_memory_mb: 0.1,
    rows_scanned: 1,
  },
};

describe('KpiCards', () => {
  it('renders baseline, final, and network delta KPIs', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <KpiCards result={processResult} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Baseline 5%')).toBeInTheDocument();
    expect(screen.getByText('85.50%')).toBeInTheDocument();
    expect(screen.getByText('Final 5%')).toBeInTheDocument();
    expect(screen.getByText('82.10%')).toBeInTheDocument();
    expect(screen.getByText('Network delta')).toBeInTheDocument();
    expect(screen.getByText('-3.40 pp')).toBeInTheDocument();
    expect(screen.queryByText('Tier 3 entities')).not.toBeInTheDocument();
  });
});
