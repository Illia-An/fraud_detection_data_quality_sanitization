import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import type { StepMetrics } from '../schemas/api';
import { appTheme } from '../theme';
import { PipelineStepsTable } from './PipelineStepsTable';

const steps: StepMetrics[] = [
  {
    step_name: 'tier1',
    rows_in: 95,
    rows_out: 90,
    rows_dropped: 5,
    top_box_pct: 84.0,
  },
  {
    step_name: 'actual',
    rows_in: 100,
    rows_out: 95,
    rows_dropped: 5,
    top_box_pct: 85.5,
  },
  {
    step_name: 'tier2',
    rows_in: 90,
    rows_out: 88,
    rows_dropped: 2,
    top_box_pct: 82.0,
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

  it('renders steps in actual → tier1 → tier2 order', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <PipelineStepsTable steps={steps} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Pipeline steps')).toBeInTheDocument();
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    const stepCells = screen.getAllByRole('cell').filter((cell) =>
      ['actual', 'tier1', 'tier2'].includes(cell.textContent ?? ''),
    );
    expect(stepCells.map((c) => c.textContent)).toEqual(['actual', 'tier1', 'tier2']);
    expect(screen.getByText('85.50%')).toBeInTheDocument();
    expect(screen.getByText('84.00%')).toBeInTheDocument();
  });
});
