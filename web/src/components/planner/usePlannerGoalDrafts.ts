import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { clampPlanHorizon, clampPlanTarget } from '../../schemas/plan';
import {
  TTS_PLAN_HORIZON_MAX,
  TTS_PLAN_HORIZON_MIN,
  TTS_PLAN_TARGET_MAX,
  TTS_PLAN_TARGET_MIN,
} from '../../schemas/ttsPlan';

export type GoalClampFn = (raw: string | number, fallback: number) => number;

export type PlannerGoalDrafts = {
  target: number;
  horizon: number;
  targetText: string;
  horizonText: string;
  setTarget: Dispatch<SetStateAction<number>>;
  setHorizon: Dispatch<SetStateAction<number>>;
  setTargetText: Dispatch<SetStateAction<string>>;
  setHorizonText: Dispatch<SetStateAction<string>>;
  /** Clamp draft texts into committed values (Run / pack). */
  commitGoalDrafts: () => { target: number; horizon: number };
  onTargetChange: (raw: string) => void;
  onHorizonChange: (raw: string) => void;
  onTargetBlur: () => void;
  onHorizonBlur: () => void;
};

/** Five-percent planner clamps (existing schema helpers). */
export const fivePercentGoalClamps = {
  clampTarget: clampPlanTarget as GoalClampFn,
  clampHorizon: clampPlanHorizon as GoalClampFn,
};

/** TTS planner clamps — same behaviour as the former page-local helpers. */
export function clampTtsPlanTarget(raw: string | number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(TTS_PLAN_TARGET_MAX, Math.max(TTS_PLAN_TARGET_MIN, n));
}

export function clampTtsPlanHorizon(raw: string | number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(TTS_PLAN_HORIZON_MAX, Math.max(TTS_PLAN_HORIZON_MIN, Math.round(n)));
}

export const ttsGoalClamps = {
  clampTarget: clampTtsPlanTarget as GoalClampFn,
  clampHorizon: clampTtsPlanHorizon as GoalClampFn,
};

/**
 * Target / horizon committed values + draft text fields with clamp-on-blur
 * and commit-before-run (shared by Planner and TTS Planner).
 */
export function usePlannerGoalDrafts(options: {
  initialTarget: number;
  initialHorizon: number;
  clampTarget: GoalClampFn;
  clampHorizon: GoalClampFn;
}): PlannerGoalDrafts {
  const { initialTarget, initialHorizon, clampTarget, clampHorizon } = options;
  const [target, setTarget] = useState(initialTarget);
  const [horizon, setHorizon] = useState(initialHorizon);
  const [targetText, setTargetText] = useState(String(initialTarget));
  const [horizonText, setHorizonText] = useState(String(initialHorizon));

  const commitGoalDrafts = useCallback((): { target: number; horizon: number } => {
    const nextTarget = clampTarget(targetText, target);
    const nextHorizon = clampHorizon(horizonText, horizon);
    setTarget(nextTarget);
    setTargetText(String(nextTarget));
    setHorizon(nextHorizon);
    setHorizonText(String(nextHorizon));
    return { target: nextTarget, horizon: nextHorizon };
  }, [clampTarget, clampHorizon, targetText, horizonText, target, horizon]);

  const onTargetChange = useCallback(
    (raw: string) => {
      if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) {
        return;
      }
      setTargetText(raw);
      if (raw !== '' && Number.isFinite(Number(raw))) {
        setTarget(Number(raw));
      }
    },
    [],
  );

  const onHorizonChange = useCallback((raw: string) => {
    if (raw !== '' && !/^\d*$/.test(raw)) {
      return;
    }
    setHorizonText(raw);
    if (raw !== '' && Number.isFinite(Number(raw))) {
      setHorizon(Number(raw));
    }
  }, []);

  const onTargetBlur = useCallback(() => {
    const next = clampTarget(targetText, target);
    setTarget(next);
    setTargetText(String(next));
  }, [clampTarget, targetText, target]);

  const onHorizonBlur = useCallback(() => {
    const next = clampHorizon(horizonText, horizon);
    setHorizon(next);
    setHorizonText(String(next));
  }, [clampHorizon, horizonText, horizon]);

  return {
    target,
    horizon,
    targetText,
    horizonText,
    setTarget,
    setHorizon,
    setTargetText,
    setHorizonText,
    commitGoalDrafts,
    onTargetChange,
    onHorizonChange,
    onTargetBlur,
    onHorizonBlur,
  };
}
