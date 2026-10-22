import { describe, expect, it } from 'vitest';

import type { TtsKpiPanel } from '../../schemas/ttsKpiPanel';
import type { TtsPlan } from '../../schemas/ttsPlan';
import { historyChain, planDoesNotRise } from './ttsHeroSeries';

const panel: TtsKpiPanel = {
  preset: 'small',
  period_start: '2025-11-01',
  period_end: '2025-12-01',
  reference_year: 2025,
  reference_month: 12,
  row_count: 4,
  rows: [
    { store_id: 10, year: 2025, month: 11, tts: 4.4 },
    { store_id: 10, year: 2025, month: 12, tts: 4.2 },
    { store_id: 20, year: 2025, month: 11, tts: 4.0 },
    { store_id: 20, year: 2025, month: 12, tts: 3.8 },
  ],
};

const plan: TtsPlan = {
  metric_id: 'tts',
  unit: 'min',
  direction: 'lower_is_better',
  target: 3.5,
  current_chain: 4,
  required_change: 0.5,
  final_chain: 3.5,
  feasible: true,
  chain_trajectory: [
    { year: 2026, month: 1, score: 3.8 },
    { year: 2026, month: 2, score: 3.5 },
  ],
  projections: [],
};

describe('tts hero series', () => {
  it('averages stores equally and keeps months in order', () => {
    expect(historyChain(panel)).toEqual([
      { label: '2025-11', minutes: 4.2 },
      { label: '2025-12', minutes: 4 },
    ]);
  });

  it('treats a falling plan as an improvement', () => {
    expect(planDoesNotRise(plan)).toBe(true);
    expect(
      planDoesNotRise({
        ...plan,
        chain_trajectory: [{ year: 2026, month: 1, score: 4.2 }],
        final_chain: 4.2,
      }),
    ).toBe(false);
  });
});
