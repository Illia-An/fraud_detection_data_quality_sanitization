/** One-level undo for the last canvas answer (pack / mix / manual run). */

import type { FivePercentPlan, PlanParams } from '../../schemas/plan';
import type { ActiveAnswer } from './activeAnswer';

export interface AnswerUndoSnapshot {
  plan: FivePercentPlan | null;
  activeAnswer: ActiveAnswer | null;
  params: PlanParams;
  mixNote: string | null;
}

export function createAnswerUndoSnapshot(input: {
  plan: FivePercentPlan | null;
  activeAnswer: ActiveAnswer | null;
  params: PlanParams;
  mixNote: string | null;
}): AnswerUndoSnapshot {
  return {
    plan: input.plan,
    activeAnswer: input.activeAnswer,
    params: { ...input.params },
    mixNote: input.mixNote,
  };
}
