import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { appTheme } from '../theme';
import { SampleDataPanel } from './SampleDataPanel';
import { useUiStore } from '../store/uiStore';

vi.mock('../api/hooks', () => ({
  useSample: vi.fn(),
  useSampleDb: vi.fn(),
}));

import { useSample, useSampleDb } from '../api/hooks';

const mockUseSample = vi.mocked(useSample);
const mockUseSampleDb = vi.mocked(useSampleDb);

const sampleMeta = {
  preset: 'small',
  row_count: 120,
  store_count: 2,
  month_count: 2,
  description: '2 stores × 2 months — quick chart demo',
};

const dbMeta = {
  preset: 'db',
  row_count: 50,
  store_count: 4,
  month_count: 3,
  description: 'SQL Server RateGetAnswers (Q10012, PII hashed)',
};

const sampleRow = {
  ParticipateNumber: 'p-1',
  Question_ID: 10012,
  Answer_Value: 5,
  PrintStore: 1,
  Year: 2026,
  Month: 1,
};

const refetch = vi.fn();

function idleQuery() {
  return {
    data: undefined,
    dataUpdatedAt: 0,
    isFetching: false,
    isError: false,
    error: null,
    isSuccess: false,
    refetch,
  };
}

function renderPanel() {
  return render(
    <ThemeProvider theme={appTheme}>
      <SampleDataPanel />
    </ThemeProvider>,
  );
}

describe('SampleDataPanel', () => {
  beforeEach(() => {
    refetch.mockReset();
    useUiStore.setState({
      lastPreset: 'db',
      periodPreset: 'from_2025',
      customFromDate: '2025-01-01',
      customToDate: '',
      surveyRows: [],
      sampleMeta: null,
      selectedStoreId: null,
      processResult: null,
    });
    mockUseSample.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
      isFetching: true,
    } as unknown as ReturnType<typeof useSampleDb>);
  });

  it('renders data source select with DB as default', () => {
    renderPanel();

    expect(screen.getByLabelText('Data source')).toBeInTheDocument();
    expect(screen.getByText('Database (Q10012)')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(screen.getByText(/Process window:/)).toBeInTheDocument();
    expect(mockUseSample).toHaveBeenCalledWith('small', false);
    expect(mockUseSampleDb).toHaveBeenCalledWith({}, true);
  });

  it('disables period control for synthetic sources', () => {
    useUiStore.setState({ lastPreset: 'small' });
    mockUseSample.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    expect(screen.getByLabelText('Period')).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByText(/Period applies to Database source only/i),
    ).toBeInTheDocument();
  });

  it('shows custom date inputs when Custom Range is selected', () => {
    useUiStore.setState({ lastPreset: 'db', periodPreset: 'custom' });
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    expect(screen.getByLabelText('Period from date')).toBeInTheDocument();
    expect(screen.getByLabelText('Period to date')).toBeInTheDocument();
  });

  it('updates period preset in uiStore', () => {
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    fireEvent.mouseDown(screen.getByLabelText('Period'));
    fireEvent.click(screen.getByRole('option', { name: '2026 YTD' }));

    expect(useUiStore.getState().periodPreset).toBe('ytd_2026');
  });

  it('stores DB meta after the default query succeeds', async () => {
    mockUseSampleDb.mockReturnValue({
      data: {
        preset: 'db',
        rows: [],
        meta: dbMeta,
      },
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch,
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/50 rows · 4 stores/)).toBeInTheDocument();
    });

    const state = useUiStore.getState();
    expect(state.surveyRows).toHaveLength(0);
    expect(state.sampleMeta?.preset).toBe('db');
    expect(state.lastPreset).toBe('db');
  });

  it('falls back to synthetic small when the DB query fails', async () => {
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
      isError: true,
      error: new Error('DATABASE_URL is not configured'),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    await waitFor(() => {
      expect(useUiStore.getState().lastPreset).toBe('small');
    });
    expect(
      screen.getByText(/DATABASE_URL is not configured.*Falling back to synthetic small/i),
    ).toBeInTheDocument();
  });

  it('shows meta after a synthetic sample loads and stores rows in uiStore', async () => {
    useUiStore.setState({ lastPreset: 'small' });
    mockUseSample.mockReturnValue({
      data: {
        preset: 'small',
        rows: [sampleRow],
        meta: sampleMeta,
      },
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch,
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/120 rows · 2 stores/)).toBeInTheDocument();
    });

    const state = useUiStore.getState();
    expect(state.surveyRows).toHaveLength(1);
    expect(state.sampleMeta?.preset).toBe('small');
  });

  it('shows JSON preview accordion for small preset', async () => {
    mockUseSample.mockReturnValue({
      data: {
        preset: 'small',
        rows: [sampleRow],
        meta: sampleMeta,
      },
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch,
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    useUiStore.setState({
      surveyRows: [sampleRow],
      sampleMeta: sampleMeta,
      lastPreset: 'small',
    });

    renderPanel();

    expect(screen.getByText('JSON preview (1 rows)')).toBeInTheDocument();
  });

  it('shows success snackbar after load', async () => {
    mockUseSampleDb.mockReturnValue({
      data: {
        preset: 'db',
        rows: [sampleRow],
        meta: dbMeta,
      },
      dataUpdatedAt: 1,
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch,
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Loaded db: 50 rows, 4 stores')).toBeInTheDocument();
    });
  });

  it('refetches the DB sample when Reload from DB is clicked', () => {
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Reload from DB' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('switches to small when selecting synthetic small from the source menu', () => {
    useUiStore.setState({ lastPreset: 'db' });
    mockUseSample.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    fireEvent.mouseDown(screen.getByLabelText('Data source'));
    fireEvent.click(screen.getByRole('option', { name: 'Synthetic — small' }));

    expect(useUiStore.getState().lastPreset).toBe('small');
  });
});
