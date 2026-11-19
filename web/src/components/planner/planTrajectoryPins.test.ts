import { describe, expect, it } from 'vitest';

import {
  linearCumulativePathToTarget,
  monthlyFromCumulativePath,
} from './heroEvaluationSeries';
import {
  assertAllocateFeasible,
  buildPinnedHorizonPath,
  normalizePins,
  recomputeSlopePlan,
  replacePin,
  type PlanPin,
} from './planTrajectoryPins';

describe('replacePin / normalizePins', () => {
  it('replacePin keeps one pin per month and newest kind wins', () => {
    const a: PlanPin = { kind: 'cumulative', monthIndex: 5, value: 72 };
    const b: PlanPin = { kind: 'monthly', monthIndex: 5, value: 80 };
    expect(replacePin([a], b)).toEqual([b]);
  });

  it('normalizePins rejects two entries for the same month', () => {
    const r = normalizePins([
      { kind: 'cumulative', monthIndex: 3, value: 70 },
      { kind: 'monthly', monthIndex: 3, value: 80 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('pin_conflict');
  });
});

describe('buildPinnedHorizonPath', () => {
  const base = {
    handoffIdx: 2,
    handoffCum: 71,
    handoffCount: 3,
    horizonEndIdx: 5, // 3 horizon months → indices 3,4,5
    target: 75,
  };

  it('pins=[] matches linearCumulativePathToTarget + monthlyFromCumulativePath', () => {
    const built = buildPinnedHorizonPath({ ...base, pins: [] });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const expectedCum = linearCumulativePathToTarget(71, 75, 3);
    const expectedM = monthlyFromCumulativePath(71, 3, expectedCum);
    expect(built.horizonCum).toEqual(expectedCum);
    expect(built.horizonMonthly).toEqual(expectedM);
    expect(built.horizonCum.at(-1)).toBeCloseTo(75);
  });

  it('works with non-trivial handoffCount (12, 14)', () => {
    for (const handoffCount of [12, 14]) {
      const built = buildPinnedHorizonPath({
        handoffIdx: 0,
        handoffCum: 70,
        handoffCount,
        horizonEndIdx: 4,
        target: 75,
        pins: [],
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const expected = monthlyFromCumulativePath(
        70,
        handoffCount,
        linearCumulativePathToTarget(70, 75, 4),
      );
      expect(built.horizonMonthly).toEqual(expected);
      // Monthlies use growing counts — not equal month weights.
      expect(built.horizonMonthly[0]).not.toBeCloseTo(built.horizonMonthly[3]!, 0);
    }
  });

  it('cumulative mid pin then linear to target', () => {
    const built = buildPinnedHorizonPath({
      ...base,
      pins: [{ kind: 'cumulative', monthIndex: 4, value: 73 }],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // step0=idx3, step1=idx4, step2=idx5
    expect(built.horizonCum[1]).toBeCloseTo(73);
    expect(built.horizonCum[2]).toBeCloseTo(75);
    const m = monthlyFromCumulativePath(71, 3, built.horizonCum);
    expect(built.horizonMonthly).toEqual(m);
  });

  it('monthly pin at first horizon month derives cum then continues to target', () => {
    const m0 = 80;
    const built = buildPinnedHorizonPath({
      ...base,
      pins: [{ kind: 'monthly', monthIndex: 3, value: m0 }],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.horizonMonthly[0]).toBeCloseTo(m0, 1);
    expect(built.horizonCum[2]).toBeCloseTo(75);
    const c0 = roundVia((m0 + 3 * 71) / 4);
    expect(built.horizonCum[0]).toBeCloseTo(c0, 1);
  });

  it('rejects out_of_bounds monthlies', () => {
    const built = buildPinnedHorizonPath({
      handoffIdx: 0,
      handoffCum: 50,
      handoffCount: 1,
      horizonEndIdx: 1,
      target: 75,
      // Huge jump in one month → monthly >> 100
      pins: [{ kind: 'cumulative', monthIndex: 1, value: 75 }],
      floor: 0,
      ceiling: 100,
    });
    // 2-step: wait horizon is 1 month only (idx 1). linear 50→75 in 1 step → monthly = 2*75-50=100 ok.
    // Use longer horizon with aggressive mid pin.
    const built2 = buildPinnedHorizonPath({
      handoffIdx: 0,
      handoffCum: 90,
      handoffCount: 10,
      horizonEndIdx: 2,
      target: 75,
      // Lowering cum fast can create monthly < 0
      pins: [{ kind: 'cumulative', monthIndex: 1, value: 10 }],
      floor: 0,
      ceiling: 100,
    });
    expect(built2.ok).toBe(false);
    if (!built2.ok) {
      expect(['out_of_bounds', 'target_miss']).toContain(built2.error.code);
    }
    void built;
  });

  it('rejects invalid_month on/before handoff', () => {
    const built = buildPinnedHorizonPath({
      ...base,
      pins: [{ kind: 'cumulative', monthIndex: 2, value: 72 }],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.code).toBe('invalid_month');
  });

  it('rejects pin_conflict from normalize', () => {
    const built = buildPinnedHorizonPath({
      ...base,
      pins: [
        { kind: 'cumulative', monthIndex: 4, value: 72 },
        { kind: 'monthly', monthIndex: 4, value: 80 },
      ],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.code).toBe('pin_conflict');
  });

  it('rejects empty_horizon', () => {
    const built = buildPinnedHorizonPath({
      handoffIdx: 5,
      handoffCum: 75,
      handoffCount: 6,
      horizonEndIdx: 5,
      target: 75,
      pins: [],
    });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.code).toBe('empty_horizon');
  });
});

describe('recomputeSlopePlan + allocate gate', () => {
  it('returns full-spine package mirroring fact through handoff', () => {
    const r = recomputeSlopePlan({
      handoffIdx: 0,
      handoffCum: 65,
      handoffCount: 1,
      horizonEndIdx: 2,
      target: 75,
      pins: [],
      spineLength: 3,
      factMonthlyThroughHandoff: [65, null, null],
      factCumThroughHandoff: [65, null, null],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.package.planYs[0]).toBe(65);
    expect(r.package.planCumYs[2]).toBeCloseTo(75);
    expect(r.package.byStore).toBeNull();
  });

  it('allocate gate passes when stores can track chain', () => {
    const spine = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];
    const r = recomputeSlopePlan({
      handoffIdx: 0,
      handoffCum: 65,
      handoffCount: 1,
      horizonEndIdx: 2,
      target: 75,
      pins: [],
      spineLength: 3,
      factMonthlyThroughHandoff: [65, null, null],
      factCumThroughHandoff: [65, null, null],
      allocate: {
        storeIds: [1, 2],
        spine,
        planningYear: 2026,
        chainPlanYs: [],
        storeActualYs: new Map([
          [1, [60, null, null]],
          [2, [70, null, null]],
        ]),
        entryScores: new Map([
          [1, 60],
          [2, 70],
        ]),
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.package.byStore).not.toBeNull();
    const err = assertAllocateFeasible(r.package.byStore!, r.package.planYs, 0);
    expect(err).toBeNull();
  });

  it('allocate_infeasible when ceiling blocks chain level', () => {
    const spine = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ];
    // Baseline linear may still be feasible; force a high mid monthly via cum path.
    // Two stores already at ceiling 70; chain needs 90 → cannot allocate.
    const r = recomputeSlopePlan({
      handoffIdx: 0,
      handoffCum: 70,
      handoffCount: 1,
      horizonEndIdx: 1,
      target: 90,
      pins: [],
      spineLength: 2,
      factMonthlyThroughHandoff: [70, null],
      factCumThroughHandoff: [70, null],
      floor: 0,
      ceiling: 100,
      allocate: {
        storeIds: [1, 2],
        spine,
        planningYear: 2026,
        chainPlanYs: [],
        storeActualYs: new Map([
          [1, [70, null]],
          [2, [70, null]],
        ]),
        entryScores: new Map([
          [1, 70],
          [2, 70],
        ]),
        opts: { floor: 0, ceiling: 70 },
        meanEpsilon: 0.05,
      },
    });
    // Chain monthly to reach cum 90 in one step: m = 2*90 - 70 = 110 → out_of_bounds first
    // Use target 75 with ceiling 70 on stores: linear 70→75 → monthly = 2*75-70=80 > store ceiling 70
    const r2 = recomputeSlopePlan({
      handoffIdx: 0,
      handoffCum: 70,
      handoffCount: 1,
      horizonEndIdx: 1,
      target: 75,
      pins: [],
      spineLength: 2,
      factMonthlyThroughHandoff: [70, null],
      factCumThroughHandoff: [70, null],
      allocate: {
        storeIds: [1, 2],
        spine,
        planningYear: 2026,
        chainPlanYs: [],
        storeActualYs: new Map([
          [1, [70, null]],
          [2, [70, null]],
        ]),
        entryScores: new Map([
          [1, 70],
          [2, 70],
        ]),
        opts: { floor: 0, ceiling: 70 },
      },
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe('allocate_infeasible');
    void r;
  });
});

describe('running-mean invert (product math, not chart stack)', () => {
  it('linear cum→monthly is not flat at target (large handoffCount overshoots)', () => {
    // m_k = (n+k)·c_k − (n+k−1)·c_{k−1}: slow linear cum rise with large n
    // forces monthlies above the EOY cum target. Chart stack is not the cause.
    const handoffCum = 71;
    const handoffCount = 14;
    const target = 75;
    const steps = 11; // Feb–Dec
    const cum = linearCumulativePathToTarget(handoffCum, target, steps);
    const monthlies = monthlyFromCumulativePath(handoffCum, handoffCount, cum);
    expect(cum[cum.length - 1]).toBe(target);
    const unique = new Set(monthlies);
    expect(unique.size).toBeGreaterThan(1);
    expect(monthlies.every((m) => m === target)).toBe(false);
    expect(Math.max(...monthlies)).toBeGreaterThan(target);
  });
});

function roundVia(value: number): number {
  return Math.round(value * 100) / 100;
}
