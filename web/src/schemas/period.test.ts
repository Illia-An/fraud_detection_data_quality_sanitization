import { describe, expect, it } from 'vitest';

import {
  formatLocalIsoDate,
  periodFieldsForProcess,
  resolvePeriodWindow,
} from './period';

describe('resolvePeriodWindow', () => {
  const now = new Date(2026, 8, 22); // local Sep 22, 2026

  it('resolves 2026 YTD through today', () => {
    expect(resolvePeriodWindow('ytd_2026', '', '', now)).toEqual({
      from_date: '2026-01-01',
      to_date: '2026-09-22',
    });
  });

  it('resolves 2025 – Present as open-ended from 2025-01-01', () => {
    expect(resolvePeriodWindow('from_2025', '', '', now)).toEqual({
      from_date: '2025-01-01',
      to_date: null,
    });
  });

  it('resolves custom range', () => {
    expect(
      resolvePeriodWindow('custom', '2025-06-01', '2025-12-31', now),
    ).toEqual({
      from_date: '2025-06-01',
      to_date: '2025-12-31',
    });
  });

  it('treats empty custom to-date as open-ended', () => {
    expect(resolvePeriodWindow('custom', '2026-02-01', '', now)).toEqual({
      from_date: '2026-02-01',
      to_date: null,
    });
  });
});

describe('periodFieldsForProcess', () => {
  it('omits to_date when open-ended', () => {
    expect(periodFieldsForProcess({ from_date: '2025-01-01', to_date: null })).toEqual({
      from_date: '2025-01-01',
    });
  });

  it('includes to_date when set', () => {
    expect(
      periodFieldsForProcess({ from_date: '2026-01-01', to_date: '2026-09-22' }),
    ).toEqual({
      from_date: '2026-01-01',
      to_date: '2026-09-22',
    });
  });
});

describe('formatLocalIsoDate', () => {
  it('formats without UTC shift', () => {
    expect(formatLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
