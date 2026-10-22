/** One-level undo for the last canvas answer (pack / mix / manual run). */

import type { FivePercentPlan, PlanParams } from '../../schemas/plan';
import type { ActiveAnswer } from './activeAnswer';

export interface AnswerUndoSnapshot<TPlan = FivePercentPlan, TParams = PlanParams> {
  plan: TPlan | null;
  activeAnswer: ActiveAnswer | null;
  params: TParams;
  mixNote: string | null;
}

export function createAnswerUndoSnapshot<TPlan, TParams extends PlanParams>(input: {
  plan: TPlan | null;
  activeAnswer: ActiveAnswer | null;
  params: TParams;
  mixNote: string | null;
}): AnswerUndoSnapshot<TPlan, TParams> {
  return {
    plan: input.plan,
    activeAnswer: input.activeAnswer,
    params: { ...input.params },
    mixNote: input.mixNote,
  };
}
