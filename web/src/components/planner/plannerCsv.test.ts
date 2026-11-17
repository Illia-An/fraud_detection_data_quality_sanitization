import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPlanProjectionCsvLines,
  downloadPlanProjectionCsv,
  downloadTextFile,
} from './plannerCsv';

describe('buildPlanProjectionCsvLines', () => {
  it('emits header, chain, and store rows', () => {
    const lines = buildPlanProjectionCsvLines({
      chain_trajectory: [
        { year: 2025, month: 1, score: 70 },
        { year: 2025, month: 2, score: 72 },
      ],
      projections: [
        {
          store_id: 10,
          months: [
            { year: 2025, month: 1, score: 68 },
            { year: 2025, month: 2, score: 71 },
          ],
        },
      ],
    });
    expect(lines[0]).toBe('store_id,2025-01,2025-02');
    expect(lines[1]).toBe('chain,70,72');
    expect(lines[2]).toBe('10,68,71');
  });

  it('leaves blank cells when a store month is missing', () => {
    const lines = buildPlanProjectionCsvLines({
      chain_trajectory: [{ year: 2025, month: 1, score: 70 }],
      projections: [{ store_id: 1, months: [] }],
    });
    expect(lines[2]).toBe('1,');
  });
});

describe('downloadTextFile / downloadPlanProjectionCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates an object URL and clicks a download anchor', () => {
    const click = vi.fn();
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: revoke });
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      return { click, href: '', download: '' } as unknown as HTMLAnchorElement;
    });

    downloadTextFile('a,b\n1,2', 'sample.csv');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:test');

    downloadPlanProjectionCsv(
      {
        chain_trajectory: [{ year: 2025, month: 1, score: 1 }],
        projections: [],
      },
      'plan.csv',
    );
    expect(click).toHaveBeenCalledTimes(2);
  });
});
