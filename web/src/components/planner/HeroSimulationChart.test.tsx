import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import { appTheme } from '../../theme';
import {
  HERO_PX_PER_PERIOD,
  HeroSimulationChart,
  heroScrollLeftToCenterIndex,
} from './HeroSimulationChart';

vi.mock('react-plotly.js', () => ({
  default: (props: { layout?: { shapes?: unknown[]; annotations?: unknown[] }; data?: unknown[] }) => (
    <div data-testid="hero-plotly">{JSON.stringify(props)}</div>
  ),
}));

const panel: SanitizedPanel = {
  period_start: '2025-01-01',
  period_end: null,
  echo_config: defaultPipelineConfig,
  reference_year: 2025,
  reference_month: 3,
  row_count: 2,
  rows: [
    { store_id: 10, year: 2025, month: 3, five_percent: 70, survey_volume: 90 },
    { store_id: 20, year: 2025, month: 3, five_percent: 74, survey_volume: 80 },
  ],
};

const draft: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 72,
  required_change: 3,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 73 },
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    { store_id: 10, months: [{ year: 2025, month: 4, score: 71 }] },
    { store_id: 20, months: [{ year: 2025, month: 4, score: 75 }] },
  ],
};

describe('HeroSimulationChart', () => {
  it('renders evaluation view with as-of boundary and fact/forecast traces', async () => {
    render(
      <ThemeProvider theme={appTheme}>
        <HeroSimulationChart
          draftPlan={draft}
          panel={panel}
          asOfYear={2025}
          asOfMonth={3}
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('hero-plotly')).toBeInTheDocument();
    });
    const payload = screen.getByTestId('hero-plotly').textContent ?? '';
    expect(payload).toContain('Cleansed fact');
    expect(payload).toContain('Required monthly (to network target)');
    expect(payload).toContain('Required cumulative (to network target)');
    expect(payload).not.toContain('Cumulative actual');
    expect(payload).not.toContain('Path to target (−3 mo)');
    expect(payload).not.toContain('Cumulative plan');
    expect(payload).toContain('Draft simulation');
    expect(screen.getByTestId('evaluation-legend-item-requiredCumulative')).toHaveAttribute(
      'data-hidden',
      'false',
    );
    expect(screen.queryByTestId('evaluation-legend-item-windowCumulative')).not.toBeInTheDocument();
    expect(screen.queryByTestId('evaluation-legend-item-planCumulative')).not.toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-requiredMonthly')).toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-windowHandoff')).toBeInTheDocument();
    expect(payload).toContain('−3 mo window');
    expect(payload).toContain('2024-12');
    expect(payload).not.toContain('Accepted plan');
    expect(payload).not.toContain('Reference baseline');
    expect(payload).toContain('as-of');
    expect(payload).toContain('2025-03');
    expect(payload).toContain('"showlegend":false');
    expect(payload).toContain('"scrollZoom":true');
    expect(payload).toContain('"hovermode":"x unified"');
    expect(payload).toContain('"showspikes":true');
    expect(payload).toContain('"xref":"paper"');
    expect(payload).toContain('"bgcolor":"rgba(33, 33, 33, 0.9)"');
    expect(payload).toContain('"size":10');
    // Match Network impact: categorical months + white plot panel.
    expect(payload).toContain('"type":"category"');
    expect(payload).toContain('"plot_bgcolor":"#ffffff"');
    // Match Sanitization Store impact: auto Y ticks (no forced 1pp grid).
    expect(payload).not.toContain('"dtick":1');
    expect(screen.getByTestId('hero-evaluation-legend')).toBeInTheDocument();
    expect(screen.getByTestId('evaluation-legend-item-draft')).toHaveTextContent(/Draft simulation/i);
    expect(screen.getByText(/not a statistical confidence interval/i)).toBeInTheDocument();
    expect(screen.getByText(/plan cutover/i)).toBeInTheDocument();
    expect(screen.getByText(/mouse wheel zooms/i)).toBeInTheDocument();
    expect(screen.getByText(/Click legend labels to show\/hide/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('evaluation-legend-item-draft'));
    await waitFor(() => {
      const afterHide = screen.getByTestId('hero-plotly').textContent ?? '';
      expect(afterHide).not.toContain('Draft simulation');
    });
    expect(screen.getByTestId('evaluation-legend-item-draft')).toHaveAttribute(
      'data-hidden',
      'true',
    );

    fireEvent.click(screen.getByTestId('evaluation-legend-item-draft'));
    await waitFor(() => {
      expect(screen.getByTestId('hero-plotly').textContent ?? '').toContain('Draft simulation');
    });
  });

});

describe('heroScrollLeftToCenterIndex', () => {
  it('centers the as-of period in the viewport when content overflows', () => {
    const periods = 40;
    const contentWidth = periods * HERO_PX_PER_PERIOD;
    const viewportWidth = 400;
    const asOfIndex = 20;
    const left = heroScrollLeftToCenterIndex(asOfIndex, periods, contentWidth, viewportWidth);
    const anchorX = (asOfIndex + 0.5) * HERO_PX_PER_PERIOD;
    expect(left).toBe(Math.round(anchorX - viewportWidth / 2));
  });

  it('clamps to zero when the strip fits the viewport', () => {
    expect(heroScrollLeftToCenterIndex(5, 10, 400, 500)).toBe(0);
  });
});
