import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { ApiStatusChip } from './ApiStatusChip';

vi.mock('../../api/hooks', () => ({
  useHealth: vi.fn(),
}));

import { useHealth } from '../../api/hooks';

const mockUseHealth = vi.mocked(useHealth);

function renderChip() {
  return render(
    <ThemeProvider theme={appTheme}>
      <ApiStatusChip />
    </ThemeProvider>,
  );
}

describe('ApiStatusChip', () => {
  it('shows checking while loading', () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useHealth>);

    renderChip();
    expect(screen.getByText('API: checking…')).toBeInTheDocument();
  });

  it('shows ok when health succeeds', () => {
    mockUseHealth.mockReturnValue({
      data: { status: 'ok', version: '0.1.0' },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useHealth>);

    renderChip();
    expect(screen.getByText('API: ok')).toBeInTheDocument();
  });

  it('shows offline on error', () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useHealth>);

    renderChip();
    expect(screen.getByText('API: offline')).toBeInTheDocument();
  });
});
