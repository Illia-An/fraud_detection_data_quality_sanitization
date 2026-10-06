import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';

import type { FivePercentPlan } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { appTheme } from '../../theme';
import { InspectStoreGlance } from './InspectStoreGlance';

const plan: FivePercentPlan = {
  metric_id: 'five_percent',
  unit: '%',
  direction: 'higher_is_better',
  target: 75,
  current_chain: 70,
  required_change: 5,
  final_chain: 74,
  feasible: true,
  chain_trajectory: [
    { year: 2025, month: 4, score: 71 },
    { year: 2025, month: 5, score: 74 },
  ],
  projections: [
    {
      store_id: 10,
      months: [
        { year: 2025, month: 4, score: 68 },
        { year: 2025, month: 5, score: 72 },
      ],
    },
  ],
};

const insights: PlanMonitoringInsights = {
  as_of_year: 2025,
  as_of_month: 4,
  band_pp: 1,
  chain: { planned: 71, actual: 66, on_track: false },
  months: [],
  stores: [
    {
      store_id: 10,
      signal: 'behind_plan',
      planned: 68,
      actual: 66,
      deviation: -2,
    },
  ],
  summary: { ahead: 0, on_plan: 0, behind: 1, insufficient: 0 },
};

describe('InspectStoreGlance', () => {
  it('shows as-of metrics and lifts End when draftLast is set', () => {
    const { rerender } = render(
      <ThemeProvider theme={appTheme}>
        <InspectStoreGlance
          plan={plan}
          insights={insights}
          storeId={10}
          baselineRows={[{ store_id: 10, five_percent: 65 }]}
          draftLast={null}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('inspect-store-glance')).toBeInTheDocument();
    expect(screen.getByText('65.0% → 72.0%')).toBeInTheDocument();
    expect(screen.getByText('+6.0 pp')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={appTheme}>
        <InspectStoreGlance
          plan={plan}
          insights={insights}
          storeId={10}
          baselineRows={[{ store_id: 10, five_percent: 65 }]}
          draftLast={80}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('65.0% → 80.0%')).toBeInTheDocument();
    expect(screen.getByText('+14.0 pp')).toBeInTheDocument();
  });
});
