import { describe, expect, it } from 'vitest';

import { ttsPlannerRunBlockReason } from './ttsPlannerRunGuards';

const ready = {
  baselineReady: true,
  storeCount: 2,
  currentChain: 4,
  target: 3.5,
  horizon: 6,
  maxMonthlyImprove: 0.25,
  isPending: false,
};

describe('ttsPlannerRunBlockReason', () => {
  it('allows a target below the current chain', () => {
    expect(ttsPlannerRunBlockReason(ready)).toBeNull();
  });

  it('blocks a target above the current chain', () => {
    expect(ttsPlannerRunBlockReason({ ...ready, target: 4.5 })).toBe('target_above_current');
  });

  it('blocks a reduction the monthly cap cannot reach', () => {
    expect(
      ttsPlannerRunBlockReason({
        ...ready,
        target: 3,
        horizon: 2,
        maxMonthlyImprove: 0.05,
      }),
    ).toBe('cap_too_tight');
  });
});
