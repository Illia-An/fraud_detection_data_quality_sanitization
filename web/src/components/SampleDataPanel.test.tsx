import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { appTheme } from '../theme';
import { SampleDataPanel } from './SampleDataPanel';
import { useUiStore } from '../store/uiStore';

vi.mock('../api/hooks', () => ({
  useSample: vi.fn(),
}));

import { useSample } from '../api/hooks';

const mockUseSample = vi.mocked(useSample);

const sampleMeta = {
  preset: 'small',
  row_count: 120,
  store_count: 2,
  month_count: 2,
  description: '2 stores × 2 months — quick chart demo',
};

const sampleRow = {
  ParticipateNumber: 'p-1',
  Question_ID: 10012,
  Answer_Value: 5,
  PrintStore: 1,
  Year: 2025,
  Month: 1,
};

function renderPanel() {
  return render(
    <ThemeProvider theme={appTheme}>
      <SampleDataPanel />
    </ThemeProvider>,
  );
}

describe('SampleDataPanel', () => {
  beforeEach(() => {
    useUiStore.setState({
      lastPreset: 'small',
      surveyRows: [],
      sampleMeta: null,
      selectedStoreId: null,
    });
    mockUseSample.mockReturnValue({
      data: undefined,
      isFetching: true,
      isError: false,
      error: null,
      isSuccess: false,
    } as ReturnType<typeof useSample>);
  });

  it('renders preset buttons and loads small by default', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'small' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'stress' })).toBeInTheDocument();
    expect(mockUseSample).toHaveBeenCalledWith('small');
  });

  it('shows meta after sample loads and stores rows in uiStore', async () => {
    mockUseSample.mockReturnValue({
      data: {
        preset: 'small',
        rows: [sampleRow],
        meta: sampleMeta,
      },
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
    } as ReturnType<typeof useSample>);

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
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
    } as ReturnType<typeof useSample>);

    useUiStore.setState({
      surveyRows: [sampleRow],
      sampleMeta: sampleMeta,
      lastPreset: 'small',
    });

    renderPanel();

    expect(screen.getByText('JSON preview (1 rows)')).toBeInTheDocument();
  });

  it('shows success snackbar after load', async () => {
    mockUseSample.mockReturnValue({
      data: {
        preset: 'small',
        rows: [sampleRow],
        meta: sampleMeta,
      },
      isFetching: false,
      isError: false,
      error: null,
      isSuccess: true,
    } as ReturnType<typeof useSample>);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Loaded small: 120 rows, 2 stores')).toBeInTheDocument();
    });
  });
});
