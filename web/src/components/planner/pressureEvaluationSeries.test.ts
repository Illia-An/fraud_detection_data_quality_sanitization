import { describe, expect, it } from 'vitest';

import { cumulativeMeanSeries } from './heroEvaluationSeries';
import { buildPressureRequiredPair } from './pressureEvaluationSeries';

describe('buildPressureRequiredPair', () => {
  it('accumulates YTD from January and cuts over at last cleansed fact', () => {
    // Jan–Mar fact, Apr–May horizon → pressure from Mar with n=3
    const labels = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const factYs = [70, 72, 74, null, null];
    const pair = buildPressureRequiredPair(labels, factYs, 75, 2026);

    expect(pair.yearStartLabel).toBe('2026-01');
    expect(pair.lastFactLabel).toBe('2026-03');
    expect(pair.lastFactIdx).toBe(2);

    // startCum = mean(70,72,74)=72; H=2 → path 73.5, 75 → monthlies invert
    expect(pair.requiredMonthlyYs[2]).toBeCloseTo(74, 2); // stitch last fact
    expect(pair.requiredMonthlyYs[0]).toBeNull();
    expect(pair.requiredMonthlyYs[1]).toBeNull();

    
    // m1 = 4*73.5 - 3*72 = 294 - 216 = 78; m2 = 5*75 - 4*73.5 = 375 - 294 = 81
    expect(pair.requiredMonthlyYs[3]).toBeCloseTo(78, 2);
    expect(pair.requiredMonthlyYs[4]).toBeCloseTo(81, 2);
    expect(cumulativeMeanSeries([70, 72, 74, 78, 81])).toEqual([70, 71, 72, 73.5, 75]);

    // YTD history Jan→Mar, then required path Apr→May
    expect(pair.requiredCumulativeYs[0]).toBeCloseTo(70, 2);
    expect(pair.requiredCumulativeYs[1]).toBeCloseTo(71, 2);
    expect(pair.requiredCumulativeYs[2]).toBeCloseTo(72, 2);
    expect(pair.requiredCumulativeYs[3]).toBeCloseTo(73.5, 2);
    expect(pair.requiredCumulativeYs[4]).toBeCloseTo(75, 2);
  });

  it('shifts handoff when a later cleansed fact appears (pressure update)', () => {
    const labels = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const before = buildPressureRequiredPair(labels, [70, 72, 74, null, null], 75, 2026);
    const after = buildPressureRequiredPair(labels, [70, 72, 74, 80, null], 75, 2026);

    expect(before.lastFactLabel).toBe('2026-03');
    expect(after.lastFactLabel).toBe('2026-04');
    expect(after.lastFactIdx).toBe(3);
    // YTD mean(70,72,74,80)=74; one horizon step → lands on 75
    expect(after.requiredMonthlyYs[3]).toBeCloseTo(80, 2);
    expect(after.requiredMonthlyYs[4]).toBeCloseTo(79, 2); // 5*75 - 4*74 = 79
    expect(after.requiredCumulativeYs[4]).toBeCloseTo(75, 2);
    // Prior Mar-cutover monthlies no longer apply at Apr
    expect(after.requiredMonthlyYs[3]).not.toBeCloseTo(before.requiredMonthlyYs[3]!, 2);
  });

  it('ignores facts before January of the pressure year', () => {
    const labels = ['2025-12', '2026-01', '2026-02', '2026-03'];
    const factYs = [50, 70, 72, null];
    const pair = buildPressureRequiredPair(labels, factYs, 75, 2026);

    expect(pair.lastFactLabel).toBe('2026-02');
    // n=2 (Jan, Feb only); startCum=71; one step → 75
    // m = 3*75 - 2*71 = 225 - 142 = 83
    expect(pair.requiredMonthlyYs[2]).toBeCloseTo(72, 2);
    expect(pair.requiredMonthlyYs[3]).toBeCloseTo(83, 2);
    expect(pair.requiredCumulativeYs[0]).toBeNull(); // before YTD year
    expect(pair.requiredCumulativeYs[1]).toBeCloseTo(70, 2);
    expect(pair.requiredCumulativeYs[2]).toBeCloseTo(71, 2);
    expect(pair.requiredCumulativeYs[3]).toBeCloseTo(75, 2);
  });

  it('returns empty curves when all facts are before year start', () => {
    const labels = ['2025-11', '2025-12', '2026-01'];
    const factYs = [60, 62, null];
    const pair = buildPressureRequiredPair(labels, factYs, 75, 2026);

    expect(pair.lastFactLabel).toBeNull();
    expect(pair.requiredMonthlyYs.every((v) => v == null)).toBe(true);
    expect(pair.requiredCumulativeYs.every((v) => v == null)).toBe(true);
  });

  it('stitches only at last fact when there is no horizon left', () => {
    const labels = ['2026-01', '2026-02'];
    const factYs = [70, 80];
    const pair = buildPressureRequiredPair(labels, factYs, 75, 2026);

    expect(pair.lastFactLabel).toBe('2026-02');
    expect(pair.requiredMonthlyYs).toEqual([null, 80]);
    expect(pair.requiredCumulativeYs[0]).toBeCloseTo(70, 2); // YTD history
    expect(pair.requiredCumulativeYs[1]).toBeCloseTo(75, 2); // mean(70,80)
    expect(pair.requiredMonthlyYs[0]).toBeNull();
  });

  it('caps H at plan target month even when the axis continues past it', () => {
    // Axis goes to Jul, but plan target month is May → H = Apr+May only (2 steps)
    const labels = [
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ];
    const factYs = [70, 72, 74, null, null, null, null];
    const uncapped = buildPressureRequiredPair(labels, factYs, 75, 2026);
    const capped = buildPressureRequiredPair(labels, factYs, 75, 2026, '2026-05');

    expect(capped.horizonEndLabel).toBe('2026-05');
    // Same as first test: H=2 → May lands on 75; Jun/Jul stay null
    expect(capped.requiredMonthlyYs[3]).toBeCloseTo(78, 2);
    expect(capped.requiredMonthlyYs[4]).toBeCloseTo(81, 2);
    expect(capped.requiredMonthlyYs[5]).toBeNull();
    expect(capped.requiredMonthlyYs[6]).toBeNull();
    expect(capped.requiredCumulativeYs[4]).toBeCloseTo(75, 2);
    expect(capped.requiredCumulativeYs[5]).toBeNull();
    // Uncapped would keep stretching toward Jul (longer H → milder early monthlies)
    expect(uncapped.requiredMonthlyYs[5]).not.toBeNull();
    expect(capped.requiredMonthlyYs[3]!).toBeGreaterThan(uncapped.requiredMonthlyYs[3]!);
  });
});
