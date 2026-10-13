import { describe, expect, it } from 'vitest';

import { resolveTourPlacement } from './tourConfig';

describe('resolveTourPlacement', () => {
  it('leaves placement unchanged in LTR', () => {
    expect(resolveTourPlacement('left', 'ltr')).toBe('left');
    expect(resolveTourPlacement('right', 'ltr')).toBe('right');
    expect(resolveTourPlacement('bottom', 'ltr')).toBe('bottom');
    expect(resolveTourPlacement('center', 'ltr')).toBe('center');
  });

  it('mirrors horizontal placement in RTL', () => {
    expect(resolveTourPlacement('left', 'rtl')).toBe('right');
    expect(resolveTourPlacement('right', 'rtl')).toBe('left');
    expect(resolveTourPlacement('top', 'rtl')).toBe('top');
    expect(resolveTourPlacement('bottom', 'rtl')).toBe('bottom');
    expect(resolveTourPlacement('center', 'rtl')).toBe('center');
  });
});
