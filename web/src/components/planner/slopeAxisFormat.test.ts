import { describe, expect, it } from 'vitest';

import {
  buildYearBandAnnotations,
  formatSlopeTickLabels,
  inferPlanningYear,
  parseYmLabel,
} from './slopeAxisFormat';

describe('slopeAxisFormat', () => {
  it('parses YYYY-MM labels', () => {
    expect(parseYmLabel('2025-01')).toEqual({ year: 2025, month: 1 });
    expect(parseYmLabel('bad')).toBeNull();
  });

  it('abbreviates ticks and re-tags year on January / year change', () => {
    expect(
      formatSlopeTickLabels([
        '2025-01',
        '2025-02',
        '2025-12',
        '2026-01',
        '2026-02',
      ]),
    ).toEqual(["Jan '25", 'Feb', 'Dec', "Jan '26", 'Feb']);
  });

  it('infers planning year as max year on the spine', () => {
    expect(inferPlanningYear(['2025-01', '2026-12'])).toBe(2026);
  });

  it('builds year-band captions under history vs planning year', () => {
    const labels = ['2025-01', '2025-06', '2026-01', '2026-12'];
    const anns = buildYearBandAnnotations(labels, 2026, {
      history: (y) => `${y} history`,
      planning: (y) => `${y} planning year`,
    });
    expect(anns).toHaveLength(2);
    expect(anns[0].text).toBe('2025 history');
    expect(anns[1].text).toBe('2026 planning year');
  });
});
