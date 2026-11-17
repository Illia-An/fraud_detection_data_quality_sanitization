import { describe, expect, it } from 'vitest';

import {
  formatScore,
  formatSigned,
  scoreDisplayForUnit,
} from './storeAuditFormat';

describe('formatSigned', () => {
  it('prefixes positive values with +', () => {
    expect(formatSigned(1.2)).toBe('+1.20');
    expect(formatSigned(0.5, 1)).toBe('+0.5');
  });

  it('keeps minus for negatives and omits + for zero', () => {
    expect(formatSigned(-0.5)).toBe('-0.50');
    expect(formatSigned(0)).toBe('0.00');
  });
});

describe('formatScore', () => {
  it('formats with the requested digits', () => {
    expect(formatScore(72.46, 1)).toBe('72.5');
    expect(formatScore(4.1, 2)).toBe('4.10');
  });
});

describe('scoreDisplayForUnit', () => {
  it('uses TTS bounds for min unit', () => {
    expect(scoreDisplayForUnit('min')).toEqual({
      digits: 2,
      floor: 0,
      ceiling: 30,
    });
  });

  it('uses 5% score bounds otherwise', () => {
    expect(scoreDisplayForUnit('%')).toEqual({
      digits: 1,
      floor: 0,
      ceiling: 100,
    });
    expect(scoreDisplayForUnit('pct')).toEqual({
      digits: 1,
      floor: 0,
      ceiling: 100,
    });
  });
});
