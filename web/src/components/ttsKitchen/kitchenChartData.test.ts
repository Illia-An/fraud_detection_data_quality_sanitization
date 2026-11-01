import { describe, expect, it } from 'vitest';

import { buildKitchenFitRange, collectKitchenMeanSeconds, kitchenPlotPoints } from './kitchenChartData';

describe('buildKitchenFitRange', () => {
  it('pads the visible seconds and leaves the axis above zero', () => {
    const values = collectKitchenMeanSeconds(
      kitchenPlotPoints([
        { year: 2026, month: 9, mean_before_sec: 210.3, mean_after_sec: 229.1 },
        { year: 2026, month: 10, mean_before_sec: 214.8, mean_after_sec: 233.6 },
      ]),
    );
    const range = buildKitchenFitRange(values);
    expect(range).not.toBeNull();
    expect(range?.[0]).toBeGreaterThan(200);
    expect(range?.[1]).toBeLessThan(250);
    expect(range?.[0]).toBeLessThan(210.3);
    expect(range?.[1]).toBeGreaterThan(233.6);
  });

  it('keeps a readable band when both lines sit on one second', () => {
    const range = buildKitchenFitRange([212.3, 212.3]);
    expect(range?.[0]).toBeCloseTo(211.3, 5);
    expect(range?.[1]).toBeCloseTo(213.3, 5);
  });

  it('returns null when the chart has no means', () => {
    expect(buildKitchenFitRange([])).toBeNull();
  });
});
