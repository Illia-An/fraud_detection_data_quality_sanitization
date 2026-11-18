import { describe, expect, it } from 'vitest';

import {
  allocateStorePlansFromChain,
  allocateStoresToChainLevel,
} from './chainStoreAllocate';

describe('allocateStoresToChainLevel', () => {
  it('hits equal-weight chain level and prefers the further-behind store', () => {
    const current = new Map([
      [1, 60],
      [2, 70],
    ]);
    const next = allocateStoresToChainLevel(current, 72);
    const mean = ([...next.values()].reduce((a, b) => a + b, 0)) / 2;
    expect(mean).toBeCloseTo(72, 1);
    // Store 1 was further below 72 → larger lift.
    expect(next.get(1)! - 60).toBeGreaterThan(next.get(2)! - 70);
  });

  it('no-ops when mean already matches', () => {
    const current = new Map([
      [1, 70],
      [2, 80],
    ]);
    const next = allocateStoresToChainLevel(current, 75);
    expect(next.get(1)).toBeCloseTo(70);
    expect(next.get(2)).toBeCloseTo(80);
  });
});

describe('allocateStorePlansFromChain', () => {
  it('mirrors actual through handoff then allocates so store mean tracks chain Plan', () => {
    const spine = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];
    const chainPlanYs = [65, 70, 75];
    const storeActualYs = new Map<number, (number | null)[]>([
      [1, [60, null, null]],
      [2, [70, null, null]],
    ]);
    const entry = new Map([
      [1, 60],
      [2, 70],
    ]);
    const plans = allocateStorePlansFromChain(
      [1, 2],
      spine,
      2026,
      chainPlanYs,
      storeActualYs,
      0,
      entry,
    );
    expect(plans.get(1)!.planYs[0]).toBeCloseTo(60);
    expect(plans.get(2)!.planYs[0]).toBeCloseTo(70);
    for (const month of [1, 2]) {
      const a = plans.get(1)!.planYs[month]!;
      const b = plans.get(2)!.planYs[month]!;
      expect((a + b) / 2).toBeCloseTo(chainPlanYs[month]!, 1);
    }
    expect(plans.get(1)!.planCumYs[2]).not.toBeNull();
    expect(plans.get(2)!.planCumYs[2]).not.toBeNull();
    // History cum of chain monthlies [65,70,75] → mean 70; store mean tracks it.
    const eoyMean =
      (plans.get(1)!.planCumYs[2]! + plans.get(2)!.planCumYs[2]!) / 2;
    expect(eoyMean).toBeCloseTo((65 + 70 + 75) / 3, 0);
  });
});
