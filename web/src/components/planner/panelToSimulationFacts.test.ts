import { describe, expect, it } from 'vitest';

import { panelToSimulationFacts } from './panelToSimulationFacts';

describe('panelToSimulationFacts', () => {
  it('maps five_percent rows and skips missing scores', () => {
    const facts = panelToSimulationFacts({
      rows: [
        { store_id: 1, year: 2025, month: 1, five_percent: 70 },
        { store_id: 1, year: 2025, month: 2 },
        { store_id: 2, year: 2025, month: 1, five_percent: 80, tts: 3 },
      ],
    });
    expect(facts).toEqual([
      { store_id: 1, year: 2025, month: 1, five_percent: 70 },
      { store_id: 2, year: 2025, month: 1, five_percent: 80 },
    ]);
  });
});
