import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFrozenYRange } from './useSlopePlotStableLayout';

describe('useFrozenYRange', () => {
  it('locks the first fitted range while freeze is true', () => {
    const { result, rerender } = renderHook(
      ({ freeze, range }) => useFrozenYRange(freeze, range),
      { initialProps: { freeze: false, range: [10, 90] as [number, number] } },
    );
    expect(result.current).toEqual([10, 90]);

    act(() => {
      rerender({ freeze: true, range: [10, 90] });
    });
    expect(result.current).toEqual([10, 90]);

    act(() => {
      rerender({ freeze: true, range: [5, 95] });
    });
    expect(result.current).toEqual([10, 90]);

    act(() => {
      rerender({ freeze: false, range: [5, 95] });
    });
    expect(result.current).toEqual([5, 95]);
  });
});
