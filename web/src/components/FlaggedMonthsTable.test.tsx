import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it } from 'vitest';

import { appTheme } from '../theme';
import { useUiStore } from '../store/uiStore';
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
  beforeEach(() => {
    useUiStore.setState({
      selectedStoreId: null,
      highlightedPeriodLabel: null,
    });
  });

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
      { ...flaggedRow, store_id: 1, volume: 40, z: 2.1 },
      { ...flaggedRow, store_id: 3, volume: 60, z: 2.2 },
      { ...flaggedRow, store_id: 2, volume: 20, z: 2.3 },
    ];

    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={flaggedRows} />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));

    const tableRows = screen.getAllByRole('row').slice(1);
    const volumeValues = tableRows.map((row) => row.querySelectorAll('td')[3]?.textContent);

    // First click on a new column sorts desc (from prior |z| desc default).
    expect(volumeValues).toEqual(['60', '40', '20']);
  });

  it('panel variant shows empty state without duplicate Card header', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={[unflaggedRow]} variant="panel" />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('flagged-months-panel')).toBeInTheDocument();
    expect(screen.queryByText('Flagged store×months')).not.toBeInTheDocument();
    expect(screen.getByText('No flagged store×months for this run.')).toBeInTheDocument();
  });

  it('panel variant puts chips, View, and search on one toolbar row', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={[flaggedRow]} variant="panel" />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('flagged-panel-toolbar')).toBeInTheDocument();
    expect(screen.queryByText('Click a row to focus the chart')).not.toBeInTheDocument();
    expect(screen.getByLabelText('View')).toBeInTheDocument();
    expect(screen.getByTestId('flagged-store-search')).toBeInTheDocument();
  });

  it('clicking a row selects store and highlights period in uiStore', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable
          rows={[
            flaggedRow,
            { ...flaggedRow, store_id: 82, year: 2026, month: 3, volume: 55, z: 3.1 },
          ]}
        />
      </ThemeProvider>,
    );

    const rows = screen.getAllByRole('row').slice(1);
    // Default sort |z| desc → store 82 (z=3.1) first
    fireEvent.click(rows[0]);

    expect(useUiStore.getState().selectedStoreId).toBe(82);
    expect(useUiStore.getState().highlightedPeriodLabel).toBe('2026-03');
  });

  it('High Z / High volume chips drive the same View filter', () => {
    const flaggedRows = [
      { ...flaggedRow, store_id: 1, volume: 20, z: 1.2 },
      { ...flaggedRow, store_id: 2, volume: 40, z: 2.5 },
      { ...flaggedRow, store_id: 3, volume: 60, z: 3.1 },
    ];

    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable rows={flaggedRows} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('flagged-chip-high-z')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3);

    fireEvent.click(screen.getByTestId('flagged-chip-high-z'));
    expect(screen.getByTestId('flagged-chip-high-z')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('View')).toHaveTextContent(/High Z/);
    // |z| >= 2 → stores 2 and 3
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
    expect(screen.queryByText('1.20')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('flagged-chip-high-volume'));
    expect(screen.getByTestId('flagged-chip-high-volume')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('flagged-chip-high-z')).toHaveAttribute('aria-pressed', 'false');
    // median volume = 40 → volume >= 40 → stores 2 and 3
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });

  it('store search filters flagged rows by store id', () => {
    render(
      <ThemeProvider theme={appTheme}>
        <FlaggedMonthsTable
          rows={[
            flaggedRow,
            { ...flaggedRow, store_id: 82, year: 2026, month: 3, volume: 55, z: 3.1 },
            { ...flaggedRow, store_id: 180, year: 2026, month: 4, volume: 30, z: 2.2 },
          ]}
        />
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByTestId('flagged-store-search'), { target: { value: '8' } });
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    const storeCells = bodyRows.map((row) => row.querySelectorAll('td')[0]?.textContent);
    expect(storeCells).toEqual(expect.arrayContaining(['82', '180']));
    expect(storeCells).not.toContain('1');
  });
});
