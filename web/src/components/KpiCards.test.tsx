import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../theme';
import { KpiCards } from './KpiCards';

const processResult = {
  baseline_top_box_pct: 85.5,
  final_top_box_pct: 82.1,
  network_delta_pp: -3.4,
  steps: [],
  high_store_months: [],
  store_impact_series: [],
  entities_flagged_tier3: 2,
  meta: {},
};

describe('KpiCards', () => {
  it('renders baseline, final, delta, and tier3 entity KPIs', () => {
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
    expect(screen.getByText('Tier 3 entities')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
