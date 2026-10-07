import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAN_PARAMS } from '../../schemas/plan';
import { createAnswerUndoSnapshot } from './answerUndo';

describe('createAnswerUndoSnapshot', () => {
  it('copies params so later lever edits do not mutate the snapshot', () => {
    const params = { ...DEFAULT_PLAN_PARAMS, priority_power: 1.5 };
    const snap = createAnswerUndoSnapshot({
      plan: null,
      activeAnswer: { kind: 'pack', id: 'close_gap' },
      params,
      mixNote: 'ready',
    });
    params.priority_power = 9;
    expect(snap.params.priority_power).toBe(1.5);
    expect(snap.activeAnswer).toEqual({ kind: 'pack', id: 'close_gap' });
    expect(snap.mixNote).toBe('ready');
  });
});
