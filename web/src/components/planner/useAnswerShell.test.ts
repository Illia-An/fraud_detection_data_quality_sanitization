import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAN_PARAMS, type PlanParams } from '../../schemas/plan';
import { useAnswerShell } from './useAnswerShell';

interface FakePlan {
  id: string;
}

const PARAMS: PlanParams = { ...DEFAULT_PLAN_PARAMS, max_monthly_improve: 3 };

function setup() {
  return renderHook(() => useAnswerShell<FakePlan, PlanParams>());
}

describe('useAnswerShell', () => {
  it('starts with an empty answer state', () => {
    const { result } = setup();
    expect(result.current.pendingPackId).toBeNull();
    expect(result.current.pendingMixId).toBeNull();
    expect(result.current.activeAnswer).toBeNull();
    expect(result.current.mixNote).toBeNull();
    expect(result.current.answerUndo).toBeNull();
  });

  it('resetAnswerState clears answer, note and undo but not pending ids', () => {
    const { result } = setup();
    act(() => {
      result.current.setPendingPackId('balanced' as never);
      result.current.setPendingMixId('even' as never);
      result.current.setActiveAnswer({ kind: 'manual' });
      result.current.setMixNote('note');
      result.current.captureUndo({ plan: { id: 'a' }, params: PARAMS });
    });
    expect(result.current.answerUndo).not.toBeNull();

    act(() => {
      result.current.resetAnswerState();
    });
    expect(result.current.activeAnswer).toBeNull();
    expect(result.current.mixNote).toBeNull();
    expect(result.current.answerUndo).toBeNull();
    expect(result.current.pendingPackId).toBe('balanced');
    expect(result.current.pendingMixId).toBe('even');
  });

  it('resetAnswerState keeps a stable identity across renders', () => {
    const { result, rerender } = setup();
    const first = result.current.resetAnswerState;
    act(() => {
      result.current.setMixNote('x');
    });
    rerender();
    expect(result.current.resetAnswerState).toBe(first);
  });

  it('captureUndo stores a snapshot of the current answer, plan and a params copy', () => {
    const { result } = setup();
    act(() => {
      result.current.setActiveAnswer({ kind: 'manual' });
      result.current.setMixNote('before');
    });
    let snap: ReturnType<typeof result.current.captureUndo> | undefined;
    act(() => {
      snap = result.current.captureUndo({ plan: { id: 'a' }, params: PARAMS });
    });
    expect(snap).toEqual({
      plan: { id: 'a' },
      activeAnswer: { kind: 'manual' },
      params: PARAMS,
      mixNote: 'before',
    });
    expect(snap?.params).not.toBe(PARAMS);
    expect(result.current.answerUndo).toEqual(snap);
  });

  it('consumeUndo returns the snapshot once and restores answer and note', () => {
    const { result } = setup();
    act(() => {
      result.current.setActiveAnswer({ kind: 'manual' });
      result.current.setMixNote('before');
    });
    act(() => {
      result.current.captureUndo({ plan: { id: 'a' }, params: PARAMS });
    });
    act(() => {
      result.current.setActiveAnswer({ kind: 'mix', id: 'even' as never });
      result.current.setMixNote('after');
    });

    let first: ReturnType<typeof result.current.consumeUndo> | undefined;
    act(() => {
      first = result.current.consumeUndo();
    });
    expect(first?.plan).toEqual({ id: 'a' });
    expect(result.current.activeAnswer).toEqual({ kind: 'manual' });
    expect(result.current.mixNote).toBe('before');
    expect(result.current.answerUndo).toBeNull();

    let second: ReturnType<typeof result.current.consumeUndo> | undefined;
    act(() => {
      second = result.current.consumeUndo();
    });
    expect(second).toBeNull();
  });

  it('consumeUndo without a captured snapshot is a no-op', () => {
    const { result } = setup();
    act(() => {
      result.current.setActiveAnswer({ kind: 'manual' });
      result.current.setMixNote('keep');
    });
    let snap: ReturnType<typeof result.current.consumeUndo> | undefined;
    act(() => {
      snap = result.current.consumeUndo();
    });
    expect(snap).toBeNull();
    expect(result.current.activeAnswer).toEqual({ kind: 'manual' });
    expect(result.current.mixNote).toBe('keep');
  });

  it('clearUndo drops the snapshot without touching answer or note', () => {
    const { result } = setup();
    act(() => {
      result.current.setActiveAnswer({ kind: 'manual' });
      result.current.setMixNote('keep');
    });
    act(() => {
      result.current.captureUndo({ plan: null, params: PARAMS });
    });
    act(() => {
      result.current.clearUndo();
    });
    expect(result.current.answerUndo).toBeNull();
    expect(result.current.activeAnswer).toEqual({ kind: 'manual' });
    expect(result.current.mixNote).toBe('keep');
  });
});
