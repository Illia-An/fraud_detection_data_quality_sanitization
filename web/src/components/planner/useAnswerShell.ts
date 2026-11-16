import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { PlanParams } from '../../schemas/plan';
import type { ScenarioPackId } from '../../schemas/scenarioPacks';
import type { StoreMixQuestionId } from '../../schemas/storeMixQuestions';
import type { ActiveAnswer } from './activeAnswer';
import { createAnswerUndoSnapshot, type AnswerUndoSnapshot } from './answerUndo';

interface AnswerShell<TPlan, TParams extends PlanParams> {
  pendingPackId: ScenarioPackId | null;
  setPendingPackId: Dispatch<SetStateAction<ScenarioPackId | null>>;
  pendingMixId: StoreMixQuestionId | null;
  setPendingMixId: Dispatch<SetStateAction<StoreMixQuestionId | null>>;
  activeAnswer: ActiveAnswer | null;
  setActiveAnswer: Dispatch<SetStateAction<ActiveAnswer | null>>;
  mixNote: string | null;
  setMixNote: Dispatch<SetStateAction<string | null>>;
  answerUndo: AnswerUndoSnapshot<TPlan, TParams> | null;
  /** Clears the active answer, its note and the undo snapshot (pending ids are untouched). */
  resetAnswerState: () => void;
  /** Stores a one-level undo snapshot of the current plan/params/answer and returns it. */
  captureUndo: (current: { plan: TPlan | null; params: TParams }) => AnswerUndoSnapshot<TPlan, TParams>;
  /** Drops the undo snapshot without restoring anything (e.g. failed run). */
  clearUndo: () => void;
  /**
   * Pops the undo snapshot and restores `activeAnswer` / `mixNote`.
   * Returns the snapshot so the page can restore its own params and plan, or `null` when empty.
   */
  consumeUndo: () => AnswerUndoSnapshot<TPlan, TParams> | null;
}

/**
 * Scenario-answer UI state shared by the planners (pack / store-mix / manual run + one-level undo).
 * Plan-specific apply logic stays in the page; keep explicit type parameters at the call site.
 */
export function useAnswerShell<TPlan, TParams extends PlanParams>(): AnswerShell<TPlan, TParams> {
  const [pendingPackId, setPendingPackId] = useState<ScenarioPackId | null>(null);
  const [pendingMixId, setPendingMixId] = useState<StoreMixQuestionId | null>(null);
  const [activeAnswer, setActiveAnswer] = useState<ActiveAnswer | null>(null);
  const [mixNote, setMixNote] = useState<string | null>(null);
  const [answerUndo, setAnswerUndo] = useState<AnswerUndoSnapshot<TPlan, TParams> | null>(null);

  // Stable identity: pages use it inside `useCallback` / effect dependencies.
  const resetAnswerState = useCallback(() => {
    setActiveAnswer(null);
    setMixNote(null);
    setAnswerUndo(null);
  }, []);

  const captureUndo = (current: { plan: TPlan | null; params: TParams }) => {
    const snap = createAnswerUndoSnapshot<TPlan, TParams>({
      plan: current.plan,
      activeAnswer,
      params: current.params,
      mixNote,
    });
    setAnswerUndo(snap);
    return snap;
  };

  const clearUndo = () => {
    setAnswerUndo(null);
  };

  const consumeUndo = () => {
    if (!answerUndo) {
      return null;
    }
    const snap = answerUndo;
    setAnswerUndo(null);
    setActiveAnswer(snap.activeAnswer);
    setMixNote(snap.mixNote);
    return snap;
  };

  return {
    pendingPackId,
    setPendingPackId,
    pendingMixId,
    setPendingMixId,
    activeAnswer,
    setActiveAnswer,
    mixNote,
    setMixNote,
    answerUndo,
    resetAnswerState,
    captureUndo,
    clearUndo,
    consumeUndo,
  };
}
