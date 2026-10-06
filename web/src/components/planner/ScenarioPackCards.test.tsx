import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PLAN_PARAMS } from '../../schemas/plan';
import { appTheme } from '../../theme';
import { ScenarioPackCards } from './ScenarioPackCards';

describe('ScenarioPackCards', () => {
  it('renders three questions and calls onApply', () => {
    const onApply = vi.fn();
    render(
      <ThemeProvider theme={appTheme}>
        <ScenarioPackCards
          disabled={false}
          disabledTip=""
          pendingId={null}
          pathParams={DEFAULT_PLAN_PARAMS}
          onApply={onApply}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('scenario-packs')).toBeInTheDocument();
    expect(screen.getByText(/Choose a question/i)).toBeInTheDocument();
    expect(screen.getByText(/How do we close the gap to Target/i)).toBeInTheDocument();
    expect(screen.getByText(/What does even monthly progress look like/i)).toBeInTheDocument();
    expect(screen.getByText(/How do we improve more at the start/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Show plan/i })).toHaveLength(3);
    expect(screen.getByTestId('planner-path-levers-summary')).toHaveTextContent(/Matches Allocator/i);

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
          pathParams={DEFAULT_PLAN_PARAMS}
          onApply={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('scenario-pack-apply-steady_grind')).toBeDisabled();
  });
});
