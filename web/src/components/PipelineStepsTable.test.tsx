import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import type { StepMetrics } from '../schemas/api';
import { appTheme } from '../theme';
import {
  PipelineStepsTable,
  buildPipelineStepRows,
  summarizeLargestDelta,
} from './PipelineStepsTable';

const steps: StepMetrics[] = [
  {
    step_name: 'tier2',
    rows_in: 90,
    rows_out: 88,
    rows_dropped: 2,
    top_box_pct: 83.0,
  },
  {
    step_name: 'tier4',
    rows_in: 87,
    rows_out: 85,
    rows_dropped: 2,
    top_box_pct: 82.0,
  },
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
    step_name: 'tier3',
    rows_in: 88,
    rows_out: 87,
    rows_dropped: 1,
    top_box_pct: 82.5,
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

  it('renders human-readable steps in actual → tier1 → … → tier4 order with Δ vs prev', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <PipelineStepsTable steps={steps} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('pipeline-steps-funnel')).toBeInTheDocument();
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    expect(screen.getByText('Δ vs prev')).toBeInTheDocument();

    const labels = [
      'Actual (baseline)',
      'Tier 1 — BlackList',
      'Tier 2 — Frequency',
      'Tier 3 — Always top-box',
      'Tier 4 — Store×month',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const stepCells = screen.getAllByRole('cell').filter((cell) =>
      labels.includes(cell.textContent ?? ''),
    );
    expect(stepCells.map((c) => c.textContent)).toEqual(labels);

    expect(screen.getByText('85.50%')).toBeInTheDocument();
    expect(screen.getByText('84.00%')).toBeInTheDocument();
    expect(screen.getByText('-1.50 pp ★')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/excluded share \d+%/).length).toBe(5);
  });

  it('marks the step with the largest absolute Δ vs prev', () => {
    const rows = buildPipelineStepRows(steps);
    const largest = rows.find((row) => row.is_largest_delta);
    expect(largest?.step_name).toBe('tier1');
    expect(summarizeLargestDelta(steps)).toBe('Tier 1 — BlackList (-1.50 pp)');
  });
});
