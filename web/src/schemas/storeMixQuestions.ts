/**
 * Store-mix (group B) questions — redistribute ahead surplus after a network plan exists.
 */

export type StoreMixQuestionId = 'lift_behind' | 'rebalance_flat';

export interface StoreMixQuestionRecipe {
  id: StoreMixQuestionId;
  clawbackDonors: boolean;
  harvestFraction: number;
  topDonors: number;
  topReceivers: number;
}

export const STORE_MIX_QUESTIONS: readonly StoreMixQuestionRecipe[] = [
  {
    id: 'lift_behind',
    clawbackDonors: false,
    harvestFraction: 0.5,
    topDonors: 10,
    topReceivers: 10,
  },
  {
    id: 'rebalance_flat',
    clawbackDonors: true,
    harvestFraction: 0.5,
    topDonors: 10,
    topReceivers: 10,
  },
] as const;

export function getStoreMixQuestion(id: StoreMixQuestionId): StoreMixQuestionRecipe {
  const hit = STORE_MIX_QUESTIONS.find((q) => q.id === id);
  if (!hit) {
    throw new Error(`Unknown store-mix question: ${id}`);
  }
  return hit;
}
