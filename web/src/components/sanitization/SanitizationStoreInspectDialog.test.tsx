import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import { appTheme } from '../../theme';
import { useUiStore } from '../../store/uiStore';
import { SanitizationStoreInspectDialog } from './SanitizationStoreInspectDialog';

const series = [
  {
    store_id: 42,
    year: 2025,
    month: 1,
    period_label: '2025-01',
    actual_five_pct: 90,
    after_tier4_five_pct: 80,
    actual_volume: 100,
    final_volume: 90,
    rows_dropped: 10,
  },
];

describe('SanitizationStoreInspectDialog', () => {
  it('renders Planner-like layout: glance, chart, flagged bottom sheet', () => {
    const onClose = vi.fn();
    useUiStore.setState({ selectedStoreId: 42 });
    render(
      <ThemeProvider theme={appTheme}>
        <SanitizationStoreInspectDialog
          open
          storeId={42}
          series={series}
          highStoreMonths={[
            {
              store_id: 42,
              year: 2025,
              month: 1,
              volume: 40,
              five_pct: 95,
              z: 2.5,
              flagged: true,
            },
          ]}
          echoConfig={defaultPipelineConfig}
          onClose={onClose}
          onStoreChange={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('sanitization-store-inspect')).toBeInTheDocument();
    expect(screen.getByText(/Inspect ·/i)).toBeInTheDocument();
    expect(screen.getByTestId('sanitization-inspect-glance')).toBeInTheDocument();
    expect(screen.getByTestId('sanitization-inspect-chart')).toBeInTheDocument();
    expect(screen.getByTestId('sanitization-inspect-flagged-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('sanitization-inspect-flagged-panel')).toBeInTheDocument();
    expect(screen.getByText(/1 flagged · expand for table/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sanitization-inspect-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
