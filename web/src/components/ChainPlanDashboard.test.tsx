import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../theme';
import { ChainPlanDashboard } from './ChainPlanDashboard';

describe('ChainPlanDashboard', () => {
  it('renders plan / target / actual rows and gap caption', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <ChainPlanDashboard
          referenceLabel="2025-03"
          target={75}
          months={[
            { year: 2025, month: 4, estimate: 71, actual: 70, delta: -1 },
            { year: 2025, month: 5, estimate: 74, actual: null, delta: null },
          ]}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('Plan estimate')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Cleansed actual')).toBeInTheDocument();
    expect(screen.getByText(/Last plan month estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/short of target/i)).toBeInTheDocument();
    expect(screen.getByText(/Actuals filled for 1\/2/i)).toBeInTheDocument();
  });
});
