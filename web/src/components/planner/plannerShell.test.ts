import { describe, expect, it } from 'vitest';

import {
  PLANNER_AT_RISK_EXPANDED_HEIGHT_PX,
  PLANNER_AT_RISK_GAP_PX,
  PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT,
  PLANNER_AT_RISK_SUMMARY_RESERVE_PX,
  PLANNER_COLLAPSED_PLAY_REVEAL_MS,
  PLANNER_PREFERRED_REFERENCE,
  pickReference,
} from './plannerShell';

describe('plannerShell constants', () => {
  it('keeps the values the pages used before the extract', () => {
    expect(PLANNER_COLLAPSED_PLAY_REVEAL_MS).toBe(250);
    expect(PLANNER_AT_RISK_SUMMARY_RESERVE_PX).toBe(52);
    expect(PLANNER_AT_RISK_EXPANDED_HEIGHT_PX).toBe(300);
    expect(PLANNER_AT_RISK_GAP_PX).toBe(12);
    expect(PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT).toBe('45vh');
    expect(PLANNER_PREFERRED_REFERENCE).toEqual({ year: 2025, month: 12 });
  });
});

describe('pickReference', () => {
  const refs = [
    { year: 2025, month: 10 },
    { year: 2025, month: 12 },
    { year: 2026, month: 3 },
  ];

  it('returns null when there are no references', () => {
    expect(pickReference([], null, null)).toBeNull();
    expect(pickReference([], 2025, 12)).toBeNull();
  });

  it('keeps the current selection when it is still available', () => {
    expect(pickReference(refs, 2025, 10)).toEqual({ year: 2025, month: 10 });
    expect(pickReference(refs, 2026, 3)).toEqual({ year: 2026, month: 3 });
  });

  it('falls back to the preferred month when the selection is empty or invalid', () => {
    expect(pickReference(refs, null, null)).toEqual({ year: 2025, month: 12 });
    expect(pickReference(refs, 2025, null)).toEqual({ year: 2025, month: 12 });
    expect(pickReference(refs, 1999, 1)).toEqual({ year: 2025, month: 12 });
  });

  it('falls back to the latest reference when the preferred month is missing', () => {
    const noPreferred = [
      { year: 2025, month: 10 },
      { year: 2026, month: 3 },
    ];
    expect(pickReference(noPreferred, null, null)).toEqual({ year: 2026, month: 3 });
    expect(pickReference(noPreferred, 1999, 1)).toEqual({ year: 2026, month: 3 });
  });
});
