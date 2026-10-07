import { describe, expect, it } from 'vitest';

import { activeAnswerLabelKey } from './activeAnswer';

describe('activeAnswerLabelKey', () => {
  it('maps pack, mix, and manual answers', () => {
    expect(activeAnswerLabelKey({ kind: 'pack', id: 'close_gap' })).toBe(
      'planner.answer.closeGap',
    );
    expect(activeAnswerLabelKey({ kind: 'mix', id: 'lift_behind' })).toBe(
      'planner.answer.liftBehind',
    );
    expect(activeAnswerLabelKey({ kind: 'manual' })).toBe('planner.answer.manual');
  });
});
