import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLANNER_COLLAPSED_PLAY_REVEAL_MS } from './plannerShell';
import { useCollapsedPlayReveal } from './useCollapsedPlayReveal';

describe('useCollapsedPlayReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden while the rail is open', () => {
    const { result } = renderHook(() => useCollapsedPlayReveal(true));
    act(() => {
      vi.advanceTimersByTime(PLANNER_COLLAPSED_PLAY_REVEAL_MS * 4);
    });
    expect(result.current).toBe(false);
  });

  it('reveals only after the delay once the rail is collapsed', () => {
    const { result } = renderHook(() => useCollapsedPlayReveal(false));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PLANNER_COLLAPSED_PLAY_REVEAL_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('hides again as soon as the rail reopens', () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useCollapsedPlayReveal(open),
      { initialProps: { open: false } },
    );
    act(() => {
      vi.advanceTimersByTime(PLANNER_COLLAPSED_PLAY_REVEAL_MS);
    });
    expect(result.current).toBe(true);

    rerender({ open: true });
    expect(result.current).toBe(false);
  });

  it('cancels a pending reveal when the rail reopens before the delay', () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useCollapsedPlayReveal(open),
      { initialProps: { open: false } },
    );
    act(() => {
      vi.advanceTimersByTime(PLANNER_COLLAPSED_PLAY_REVEAL_MS - 10);
    });
    rerender({ open: true });
    act(() => {
      vi.advanceTimersByTime(PLANNER_COLLAPSED_PLAY_REVEAL_MS * 2);
    });
    expect(result.current).toBe(false);
  });
});
