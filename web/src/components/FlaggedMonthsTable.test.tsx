import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { appTheme } from '../theme';
import { FlaggedMonthsTable } from './FlaggedMonthsTable';

const flaggedRow = {
  store_id: 1,
  year: 2025,
  month: 1,
  volume: 40,
  five_pct: 95.0,
  z: 2.5,
  flagged: true,
};

const unflaggedRow = {
  store_id: 2,
  year: 2025,
  month: 2,
  volume: 20,
  five_pct: 80.0,
  z: 0.5,
  flagged: false,
};

describe('FlaggedMonthsTable', () => {
  it('renders nothing when no flagged rows', () => {
    const { container } = render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={[unflaggedRow]} />
      </ThemeProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders only flagged store×month rows', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={[flaggedRow, unflaggedRow]} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Flagged store×months')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByText('80.0%')).not.toBeInTheDocument();
  });

  it('sorts by volume when header is clicked', () => {
    const flaggedRows = [
      { ...flaggedRow, store_id: 1, volume: 40 },
      { ...flaggedRow, store_id: 3, volume: 60 },
      { ...flaggedRow, store_id: 2, volume: 20 },
    ];

    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={flaggedRows} />
      </ThemeProvider>,
    );

    const volumeHeader = screen.getByRole('button', { name: 'Volume' });
    fireEvent.click(volumeHeader);
    fireEvent.click(volumeHeader);

    const tableRows = screen.getAllByRole('row').slice(1);
    const volumeValues = tableRows.map((row) => row.querySelectorAll('td')[3]?.textContent);

    expect(volumeValues).toEqual(['20', '40', '60']);
  });
});
