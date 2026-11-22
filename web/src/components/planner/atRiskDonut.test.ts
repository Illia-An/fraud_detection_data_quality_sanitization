import { describe, expect, it } from 'vitest';

import { buildAtRiskDonutSlices } from './atRiskDonut';

describe('buildAtRiskDonutSlices', () => {
  it('omits empty signals and proportions sum to ~1', () => {
    const { slices, total } = buildAtRiskDonutSlices({
      behind: 72,
      ahead: 134,
      on_plan: 10,
      insufficient: 0,
    });
    expect(total).toBe(216);
    expect(slices.map((s) => s.signal)).toEqual(['behind_plan', 'on_plan', 'ahead_of_plan']);
    const shareSum = slices.reduce((sum, s) => sum + s.share, 0);
    expect(shareSum).toBeCloseTo(1, 6);
    expect(slices.every((s) => s.path.startsWith('M '))).toBe(true);
  });

  it('returns no slices when everything is zero', () => {
    expect(
      buildAtRiskDonutSlices({ behind: 0, ahead: 0, on_plan: 0, insufficient: 0 }),
    ).toEqual({ slices: [], total: 0 });
  });
});
