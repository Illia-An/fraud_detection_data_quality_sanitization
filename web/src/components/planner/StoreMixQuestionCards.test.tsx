import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { StoreMixQuestionCards } from './StoreMixQuestionCards';

describe('StoreMixQuestionCards', () => {
  it('renders two mix questions and calls onApply', () => {
    const onApply = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <StoreMixQuestionCards
          disabled={false}
          disabledTip=""
          pendingId={null}
          onApply={onApply}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('store-mix-questions')).toBeInTheDocument();
    expect(screen.getByText(/Choose a store-mix question/i)).toBeInTheDocument();
    expect(
      screen.getByText(/How do we lift behind stores using ahead surplus/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/How do we rebalance stores without raising the network/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Show adjustment/i })).toHaveLength(2);

    fireEvent.click(screen.getByTestId('store-mix-apply-lift_behind'));
    expect(onApply).toHaveBeenCalledWith('lift_behind');
  });

  it('disables apply when blocked', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <StoreMixQuestionCards
          disabled
          disabledTip="blocked"
          pendingId={null}
          onApply={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('store-mix-apply-rebalance_flat')).toBeDisabled();
  });
});
