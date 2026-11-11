import { describe, expect, it } from 'vitest';

import {
  asOfShapes,
  lastFinitePoint,
  SLOPE_CUMULATIVE_DEFAULT_HIDDEN,
  SLOPE_CUMULATIVE_LEGEND,
  SLOPE_MONTHLY_DEFAULT_HIDDEN,
  SLOPE_MONTHLY_LEGEND,
  splitSeriesAtAsOf,
} from './slopeHeroShared';

describe('slope required legend wiring', () => {
  it('exposes required series and hides them by default', () => {
    expect(SLOPE_CUMULATIVE_LEGEND.some((i) => i.id === 'requiredCumulative')).toBe(true);
    expect(SLOPE_MONTHLY_LEGEND.some((i) => i.id === 'requiredMonthly')).toBe(true);
    expect(SLOPE_CUMULATIVE_DEFAULT_HIDDEN).toContain('requiredCumulative');
    expect(SLOPE_MONTHLY_DEFAULT_HIDDEN).toContain('requiredMonthly');
  });
});

describe('splitSeriesAtAsOf', () => {
  it('keeps fact through as-of and forecast from as-of inclusive', () => {
    const values = [10, 20, 30, 40, 50];
    const { fact, forecast } = splitSeriesAtAsOf(values, 2);
    expect(fact).toEqual([10, 20, 30, null, null]);
    expect(forecast).toEqual([null, null, 30, 40, 50]);
  });

  it('treats missing as-of as all-forecast', () => {
    const values = [1, 2, null];
    const { fact, forecast } = splitSeriesAtAsOf(values, -1);
    expect(fact).toEqual([null, null, null]);
    expect(forecast).toEqual([1, 2, null]);
  });
});

describe('asOfShapes', () => {
  it('returns a vertical line and optional annotation at the cutover label', () => {
    const { shapes, annotations } = asOfShapes('2026-01', true, 'fact→plan/forecast');
    expect(shapes).toHaveLength(1);
    expect(shapes[0].x0).toBe('2026-01');
    expect(annotations).toHaveLength(1);
    expect(annotations[0].text).toBe('fact→plan/forecast');
  });

  it('hides shapes when not visible', () => {
    const { shapes, annotations } = asOfShapes('2026-01', false, 'x');
    expect(shapes).toEqual([]);
    expect(annotations).toEqual([]);
  });
});

describe('lastFinitePoint', () => {
  it('returns the last non-null value', () => {
    expect(lastFinitePoint(['a', 'b', 'c'], [1, null, 3])).toEqual({ label: 'c', value: 3 });
    expect(lastFinitePoint(['a'], [null])).toBeNull();
  });
});
