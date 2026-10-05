import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../../theme';
import {
  EvaluationLegend,
  HERO_EVALUATION_LEGEND,
} from './EvaluationLegend';

describe('EvaluationLegend', () => {
  it('renders legend items with accessible tips', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <EvaluationLegend items={HERO_EVALUATION_LEGEND} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('evaluation-legend')).toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-draft')).toHaveTextContent(
      /Draft simulation/i,
    );
    expect(screen.getByTestId('evaluation-legend-item-draft')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Draft simulation.*monthly draft plan/i),
    );
  });
});
