import { describe, expect, it } from 'vitest';

import type { FivePercentPlan } from './plan';
import {
  applySandboxEvenSplitToPlan,
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

  it('applySandboxEvenSplitToPlan writes last-month scores and recomputes chain', () => {
    const plan: FivePercentPlan = {
      metric_id: 'five_percent',
      unit: '%',
      direction: 'higher_is_better',
      target: 75,
      current_chain: 70,
      required_change: 5,
      final_chain: 75,
      feasible: true,
      chain_trajectory: [{ year: 2025, month: 5, score: 75 }],
      projections: [
        { store_id: 10, months: [{ year: 2025, month: 5, score: 70 }] },
        { store_id: 20, months: [{ year: 2025, month: 5, score: 80 }] },
        { store_id: 30, months: [{ year: 2025, month: 5, score: 75 }] },
      ],
    };
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
    const next = applySandboxEvenSplitToPlan(plan, preview, 2025, 5);
    expect(next.projections.find((p) => p.store_id === 10)?.months[0].score).toBeCloseTo(
      preview.draft,
      5,
    );
    expect(next.final_chain).toBeCloseTo(
      next.projections.reduce((sum, p) => sum + p.months[0].score, 0) / 3,
      5,
    );
    // Source plan untouched.
    expect(plan.projections[0].months[0].score).toBe(70);
  });
});
