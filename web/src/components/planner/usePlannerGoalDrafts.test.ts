import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  clampTtsPlanHorizon,
  clampTtsPlanTarget,
  fivePercentGoalClamps,
  ttsGoalClamps,
  usePlannerGoalDrafts,
} from './usePlannerGoalDrafts';

describe('clampTtsPlanTarget / clampTtsPlanHorizon', () => {
  it('clamps TTS target to 0–30 and horizon to 1–12', () => {
    expect(clampTtsPlanTarget(40, 3.5)).toBe(30);
    expect(clampTtsPlanTarget(-1, 3.5)).toBe(0);
    expect(clampTtsPlanTarget('x', 3.5)).toBe(3.5);
    expect(clampTtsPlanHorizon(0, 12)).toBe(1);
    expect(clampTtsPlanHorizon(20, 12)).toBe(12);
    expect(clampTtsPlanHorizon(3.7, 12)).toBe(4);
  });
});

describe('usePlannerGoalDrafts', () => {
  it('commits five_percent drafts via schema clamps', () => {
    const { result } = renderHook(() =>
      usePlannerGoalDrafts({
        initialTarget: 75,
        initialHorizon: 12,
        ...fivePercentGoalClamps,
      }),
    );

    act(() => {
      result.current.onTargetChange('80.55');
      result.current.onHorizonChange('6');
    });
    let goal = { target: 0, horizon: 0 };
    act(() => {
      goal = result.current.commitGoalDrafts();
    });
    expect(goal).toEqual({ target: 80.6, horizon: 6 });
    expect(result.current.targetText).toBe('80.6');
    expect(result.current.horizonText).toBe('6');
  });

  it('blur clamps TTS target text', () => {
    const { result } = renderHook(() =>
      usePlannerGoalDrafts({
        initialTarget: 3.5,
        initialHorizon: 12,
        ...ttsGoalClamps,
      }),
    );

    act(() => {
      result.current.onTargetChange('99');
    });
    act(() => {
      result.current.onTargetBlur();
    });
    expect(result.current.target).toBe(30);
    expect(result.current.targetText).toBe('30');
  });
});
