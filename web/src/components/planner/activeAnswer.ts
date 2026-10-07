/** Session label for which question/path produced the current canvas draft. */

import type { MessageKey } from '../../i18n';
import type { ScenarioPackId } from '../../schemas/scenarioPacks';
import type { StoreMixQuestionId } from '../../schemas/storeMixQuestions';

export type ActiveAnswer =
  | { kind: 'pack'; id: ScenarioPackId }
  | { kind: 'mix'; id: StoreMixQuestionId }
  | { kind: 'manual' };

const PACK_ANSWER_KEYS: Record<ScenarioPackId, MessageKey> = {
  close_gap: 'planner.answer.closeGap',
  steady_grind: 'planner.answer.steady',
  front_loaded: 'planner.answer.frontLoaded',
};

const MIX_ANSWER_KEYS: Record<StoreMixQuestionId, MessageKey> = {
  lift_behind: 'planner.answer.liftBehind',
  rebalance_flat: 'planner.answer.rebalance',
};

export function activeAnswerLabelKey(answer: ActiveAnswer): MessageKey {
  if (answer.kind === 'pack') {
    return PACK_ANSWER_KEYS[answer.id];
  }
  if (answer.kind === 'mix') {
    return MIX_ANSWER_KEYS[answer.id];
  }
  return 'planner.answer.manual';
}
