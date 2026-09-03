import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import type { StepMetrics } from '../schemas/api';
import { appTheme } from '../theme';
import { PipelineStepsTable } from './PipelineStepsTable';

const steps: StepMetrics[] = [
  {
    step_name: '0_raw_q10012',
    rows_in: 100,
    rows_out: 95,
    rows_dropped: 5,
    top_box_rate_pct: 85.5,
    drop_reasons: {},
  },
  {
    step_name: '1_tier1',
    rows_in: 95,
    rows_out: 90,
    rows_dropped: 5,
    top_box_rate_pct: 84.0,
    drop_reasons: { staff_blacklist: 3 },
  },
];

describe('PipelineStepsTable', () => {
  it('renders nothing when steps are empty', () => {
    const { container } = render(
      <ThemeProvider theme={appTheme}>
        <PipelineStepsTable steps={[]} />
      </ThemeProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders pipeline step metrics', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <PipelineStepsTable steps={steps} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Pipeline steps')).toBeInTheDocument();
    expect(screen.getByText('0_raw_q10012')).toBeInTheDocument();
    expect(screen.getByText('1_tier1')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('85.50%')).toBeInTheDocument();
    expect(screen.getByText('84.00%')).toBeInTheDocument();
  });
});
