import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../../theme';
import SideMenu from './SideMenu';

function renderSideMenu() {
  return render(
    <ThemeProvider theme={appTheme}>
      <MemoryRouter>
        <SideMenu />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('SideMenu', () => {
  it('starts collapsed as mini rail and expands on demand', () => {
    renderSideMenu();

    expect(screen.queryByText('Survey Sanitization')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sanitization/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Planner$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));

    expect(screen.getByText('Survey Sanitization')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sanitization/i })).toBeInTheDocument();
  });
});
