import { describe, expect, it } from 'vitest';

import {
  clampPlanHorizon,
  clampPlanTarget,
  PLAN_HORIZON_MAX,
  PLAN_HORIZON_MIN,
  PLAN_TARGET_MAX,
  PLAN_TARGET_MIN,
} from './plan';

describe('clampPlanHorizon', () => {
  it('clamps to 1–12 and rounds', () => {
    expect(clampPlanHorizon(0)).toBe(PLAN_HORIZON_MIN);
    expect(clampPlanHorizon(24)).toBe(PLAN_HORIZON_MAX);
    expect(clampPlanHorizon(6.7)).toBe(7);
    expect(clampPlanHorizon('')).toBe(PLAN_HORIZON_MAX);
    expect(clampPlanHorizon('abc', 3)).toBe(3);
  });
});

describe('clampPlanTarget', () => {
  it('clamps to 0–100 at one decimal', () => {
    expect(clampPlanTarget(-1)).toBe(PLAN_TARGET_MIN);
    expect(clampPlanTarget(150)).toBe(PLAN_TARGET_MAX);
    expect(clampPlanTarget(75.16)).toBe(75.2);
    expect(clampPlanTarget('', 70)).toBe(70);
  });
});
