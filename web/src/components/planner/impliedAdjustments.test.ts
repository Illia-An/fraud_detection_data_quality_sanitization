import { describe, expect, it } from 'vitest';

import { mergeImpliedAdjustment } from './impliedAdjustments';

describe('mergeImpliedAdjustment', () => {
  it('adds the first override', () => {
    expect(
      mergeImpliedAdjustment([], { store_id: 35, new_implied_target: 63.5 }),
    ).toEqual([{ store_id: 35, new_implied_target: 63.5 }]);
  });

  it('keeps prior stores when applying another', () => {
    const current = [{ store_id: 35, new_implied_target: 63.5 }];
    expect(
      mergeImpliedAdjustment(current, { store_id: 75, new_implied_target: 45.6 }),
    ).toEqual([
      { store_id: 35, new_implied_target: 63.5 },
      { store_id: 75, new_implied_target: 45.6 },
    ]);
  });

  it('replaces the same store_id', () => {
    const current = [
      { store_id: 35, new_implied_target: 63.5 },
      { store_id: 75, new_implied_target: 45.6 },
    ];
    expect(
      mergeImpliedAdjustment(current, { store_id: 35, new_implied_target: 62.0 }),
    ).toEqual([
      { store_id: 35, new_implied_target: 62.0 },
      { store_id: 75, new_implied_target: 45.6 },
    ]);
  });
});
