import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PLANNER_PREFERRED_REFERENCE, type PlannerReference } from './plannerShell';
import { useReferenceSelection } from './useReferenceSelection';

const REFS: PlannerReference[] = [
  { year: 2025, month: 10 },
  { year: 2025, month: 12 },
  { year: 2026, month: 3 },
];

describe('useReferenceSelection', () => {
  it('starts empty and stays empty while there are no references', () => {
    const { result } = renderHook(() => useReferenceSelection([]));
    expect(result.current.referenceYear).toBeNull();
    expect(result.current.referenceMonth).toBeNull();
  });

  it('selects the preferred month once references arrive', () => {
    const { result, rerender } = renderHook(
      ({ refs }: { refs: PlannerReference[] }) => useReferenceSelection(refs),
      { initialProps: { refs: [] as PlannerReference[] } },
    );
    rerender({ refs: REFS });
    expect(result.current.referenceYear).toBe(2025);
    expect(result.current.referenceMonth).toBe(12);
  });

  it('selects the latest month when the preferred one is not available', () => {
    const refs = [
      { year: 2025, month: 10 },
      { year: 2026, month: 3 },
    ];
    const { result } = renderHook(() => useReferenceSelection(refs));
    expect(result.current.referenceYear).toBe(2026);
    expect(result.current.referenceMonth).toBe(3);
  });

  it('keeps the initial selection when it is available', () => {
    const { result } = renderHook(() => useReferenceSelection(REFS, { year: 2025, month: 10 }));
    expect(result.current.referenceYear).toBe(2025);
    expect(result.current.referenceMonth).toBe(10);
  });

  it('keeps a manual selection made through the setters', () => {
    const { result } = renderHook(() => useReferenceSelection(REFS, PLANNER_PREFERRED_REFERENCE));
    act(() => {
      result.current.setReferenceYear(2026);
      result.current.setReferenceMonth(3);
    });
    expect(result.current.referenceYear).toBe(2026);
    expect(result.current.referenceMonth).toBe(3);
  });

  it('repairs a selection that disappears from the references', () => {
    const { result, rerender } = renderHook(
      ({ refs }: { refs: PlannerReference[] }) =>
        useReferenceSelection(refs, { year: 2026, month: 3 }),
      { initialProps: { refs: REFS } },
    );
    expect(result.current.referenceMonth).toBe(3);

    rerender({ refs: [{ year: 2025, month: 10 }] });
    expect(result.current.referenceYear).toBe(2025);
    expect(result.current.referenceMonth).toBe(10);
  });
});
