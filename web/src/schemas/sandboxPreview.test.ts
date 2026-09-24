import { describe, expect, it } from 'vitest';

import {
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
} from './sandboxPreview';

describe('sandboxPreview', () => {
  it('clips proposed score to monthly bounds', () => {
    const bounds = sandboxScoreBounds(70, 72, 4);
    expect(bounds.min).toBe(66);
    expect(bounds.max).toBe(74);
    expect(clipSandboxScore(80, bounds)).toBe(74);
  });

  it('redistributes opposite delta across other stores', () => {
    const preview = previewSandboxEvenSplit({
      selectedStoreId: 10,
      selectedSignal: 'behind_plan',
      originalLast: 70,
      proposedLast: 72,
      previousScore: 69,
      others: [
        { store_id: 20, last: 80, signal: 'ahead_of_plan' },
        { store_id: 30, last: 75, signal: 'on_plan' },
      ],
      maxMonthlyImprove: 4,
    });
    expect(preview.taken).toBeCloseTo(2, 5);
    expect(preview.distributed + preview.leftover).toBeCloseTo(2, 4);
    const poolDelta = preview.pool.reduce((sum, row) => sum + row.applied_delta, 0);
    expect(poolDelta).toBeCloseTo(-2, 4);
  });
});
