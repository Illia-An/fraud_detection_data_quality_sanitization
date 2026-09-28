import { describe, expect, it } from 'vitest';

import { plannerRunBlockReason } from './plannerRunGuards';

describe('plannerRunBlockReason', () => {
  const base = {
    baselineReady: true,
    storeCount: 3,
    currentChain: 70,
    target: 75,
    horizon: 6,
    maxMonthlyImprove: 4,
    isPending: false,
  };

  it('allows a feasible improve path', () => {
    expect(plannerRunBlockReason(base)).toBeNull();
  });

  it('blocks missing baseline and tight caps', () => {
    expect(plannerRunBlockReason({ ...base, baselineReady: false })).toBe('no_baseline');
    expect(
      plannerRunBlockReason({
        ...base,
        target: 95,
        horizon: 2,
        maxMonthlyImprove: 1,
      }),
    ).toBe('cap_too_tight');
  });
});
