import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { PlannerSandboxBar } from './PlannerSandboxBar';

describe('PlannerSandboxBar', () => {
  it('fires discard, commit, and export actions', () => {
    const onDiscard = vi.fn();
    const onCommitSession = vi.fn();
    const onExportCsv = vi.fn();

    render(
      <ThemeProvider theme={appTheme}>
        <PlannerSandboxBar
          targetPct={75}
          horizonMonths={6}
          hasAcceptedSnapshot={false}
          onDiscard={onDiscard}
          onCommitSession={onCommitSession}
          onExportCsv={onExportCsv}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText(/unsaved scenario/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Discard changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Commit plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(onDiscard).toHaveBeenCalled();
    expect(onCommitSession).toHaveBeenCalled();
    expect(onExportCsv).toHaveBeenCalled();
  });
});
