import { describe, expect, it } from 'vitest';

import { getStoreMixQuestion, STORE_MIX_QUESTIONS } from './storeMixQuestions';

describe('storeMixQuestions', () => {
  it('exposes lift_behind (spend) and rebalance_flat (clawback)', () => {
    expect(STORE_MIX_QUESTIONS.map((q) => q.id)).toEqual(['lift_behind', 'rebalance_flat']);
    expect(getStoreMixQuestion('lift_behind').clawbackDonors).toBe(false);
    expect(getStoreMixQuestion('rebalance_flat').clawbackDonors).toBe(true);
    expect(getStoreMixQuestion('lift_behind').harvestFraction).toBe(0.5);
  });
});
