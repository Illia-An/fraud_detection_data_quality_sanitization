import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { SanitizationScenarioPackCards } from './SanitizationScenarioPackCards';

describe('SanitizationScenarioPackCards', () => {
  it('renders three questions and calls onApply', () => {
    const onApply = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <SanitizationScenarioPackCards
          disabled={false}
          disabledTip=""
          pendingId={null}
          onApply={onApply}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('sanitization-scenario-packs')).toBeInTheDocument();
    expect(screen.getByText(/Choose a question/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Show result/i })).toHaveLength(3);

    fireEvent.click(screen.getByTestId('sanitization-pack-apply-with_store_month'));
    expect(onApply).toHaveBeenCalledWith('with_store_month');
  });

  it('disables apply and shows human reason on each card', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <SanitizationScenarioPackCards
          disabled
          disabledTip="Load survey data first (database or synthetic preset)."
          pendingId={null}
          onApply={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('sanitization-pack-apply-core_only')).toBeDisabled();
    expect(screen.getByTestId('sanitization-pack-disabled-reason-core_only')).toHaveTextContent(
      /Load survey data first/i,
    );
    expect(screen.getByTestId('sanitization-pack-disabled-reason-standard_spec')).toBeInTheDocument();
    expect(
      screen.getByTestId('sanitization-pack-disabled-reason-with_store_month'),
    ).toBeInTheDocument();
  });

  it('hides disabled reason when packs are enabled', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <SanitizationScenarioPackCards
          disabled={false}
          disabledTip="Load survey data first"
          pendingId={null}
          onApply={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('sanitization-pack-disabled-reason-core_only')).not.toBeInTheDocument();
  });
});
