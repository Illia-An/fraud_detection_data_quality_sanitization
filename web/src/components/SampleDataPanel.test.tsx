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

  it('renders DB as the default source and keeps synthetic disabled', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'small' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load from DB' })).toBeInTheDocument();
    expect(mockUseSample).toHaveBeenCalledWith('small', false);
    expect(mockUseSampleDb).toHaveBeenCalledWith({}, true);
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
      expect(screen.getByText(/50.*4 stores/)).toBeInTheDocument();
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
      expect(screen.getByText(/120.*2 stores/)).toBeInTheDocument();
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

  it('refetches the DB sample when Load from DB is clicked', () => {
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Load from DB' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('switches back to db when Load from DB is clicked from a synthetic preset', () => {
    useUiStore.setState({ lastPreset: 'small' });
    mockUseSample.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSample>);
    mockUseSampleDb.mockReturnValue({
      ...idleQuery(),
    } as unknown as ReturnType<typeof useSampleDb>);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Load from DB' }));

    expect(useUiStore.getState().lastPreset).toBe('db');
    expect(refetch).not.toHaveBeenCalled();
  });
});
