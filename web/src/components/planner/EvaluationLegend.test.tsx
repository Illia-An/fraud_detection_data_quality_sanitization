import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { defaultPipelineConfig } from '../../schemas/api';
import {
  EvaluationLegend,
  HERO_EVALUATION_LEGEND,
  networkImpactLegendItems,
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

  it('toggles series visibility when interactive', () => {
    const onToggle = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <EvaluationLegend
          items={HERO_EVALUATION_LEGEND}
          hiddenIds={new Set(['draft'])}
          onToggle={onToggle}
        />
      </ThemeProvider>,
    );

    const draft = screen.getByTestId('evaluation-legend-item-draft');
    expect(draft).toHaveAttribute('data-hidden', 'true');
    expect(draft).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(draft);
    expect(onToggle).toHaveBeenCalledWith('draft');
  });

  it('filters network impact legend by enabled tiers', () => {
    // defaultPipelineConfig leaves Tier 4 off (SPEC default).
    expect(networkImpactLegendItems(defaultPipelineConfig).map((item) => item.id)).toEqual([
      'actual',
      'tier1',
      'tier2',
      'tier3',
    ]);

    const withTier4 = networkImpactLegendItems({
      ...defaultPipelineConfig,
      tier4_enabled: true,
    });
    expect(withTier4.map((item) => item.id)).toEqual([
      'actual',
      'tier1',
      'tier2',
      'tier3',
      'tier4',
    ]);

    const coreOnly = networkImpactLegendItems({
      ...defaultPipelineConfig,
      tier3_always_five_enabled: false,
      tier4_enabled: false,
    });
    expect(coreOnly.map((item) => item.id)).toEqual(['actual', 'tier1', 'tier2']);
  });
});
