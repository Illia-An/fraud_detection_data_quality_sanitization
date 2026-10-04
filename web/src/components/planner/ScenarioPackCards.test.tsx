import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { ScenarioPackCards } from './ScenarioPackCards';

describe('ScenarioPackCards', () => {
  it('renders three packs and calls onApply', () => {
    const onApply = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <ScenarioPackCards
          disabled={false}
          disabledTip=""
          pendingId={null}
          onApply={onApply}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('scenario-packs')).toBeInTheDocument();
    expect(screen.getByText(/Close the gap/i)).toBeInTheDocument();
    expect(screen.getByText(/Rebalance/i)).toBeInTheDocument();
    expect(screen.getByText(/Steady grind/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scenario-pack-apply-close_gap'));
    expect(onApply).toHaveBeenCalledWith('close_gap');
  });

  it('disables apply when blocked', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <ScenarioPackCards
          disabled
          disabledTip="blocked"
          pendingId={null}
          onApply={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('scenario-pack-apply-steady_grind')).toBeDisabled();
  });
});
