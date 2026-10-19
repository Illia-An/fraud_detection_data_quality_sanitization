import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appTheme } from '../../theme';
import { defaultTtsPipelineConfig } from '../../schemas/tts';
import type { TtsSanitizedPanel } from '../../schemas/ttsSanitizedPanel';
import { TtsPanelHandoffBar } from './TtsPanelHandoffBar';

const downloadSpy = vi.fn();

vi.mock('../../schemas/ttsSanitizedPanel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../schemas/ttsSanitizedPanel')>();
  return {
    ...actual,
    downloadTtsSanitizedPanelCsv: (...args: unknown[]) => downloadSpy(...args),
  };
});

const readyPanel: TtsSanitizedPanel = {
  period_start: '2026-09-01',
  period_end: '2026-10-17',
  echo_config: defaultTtsPipelineConfig,
  reference_year: 2026,
  reference_month: 10,
  row_count: 2,
  rows: [
    { store_id: 10, year: 2026, month: 9, tts_sec: 218, volume: 1100 },
    { store_id: 20, year: 2026, month: 10, tts_sec: 240, volume: 500 },
  ],
};

function renderBar(panel: TtsSanitizedPanel | null) {
  return render(
    <ThemeProvider theme={appTheme}>
      <TtsPanelHandoffBar panel={panel} />
    </ThemeProvider>,
  );
}

describe('TtsPanelHandoffBar', () => {
  beforeEach(() => {
    downloadSpy.mockReset();
  });

  it('shows missing state when panel is empty', () => {
    renderBar(null);
    expect(screen.getByTestId('tts-panel-chip')).toHaveTextContent('TTS panel not ready');
    expect(screen.queryByTestId('tts-panel-export-csv')).not.toBeInTheDocument();
  });

  it('shows ready chip and exports CSV', () => {
    renderBar(readyPanel);
    expect(screen.getByTestId('tts-panel-chip')).toHaveTextContent('2 cells');
    expect(screen.getByTestId('tts-panel-meta')).toHaveTextContent('2026-10');
    fireEvent.click(screen.getByTestId('tts-panel-export-csv'));
    expect(downloadSpy).toHaveBeenCalledWith(readyPanel);
  });
});
