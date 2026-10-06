import { describe, expect, it } from 'vitest';

import { getScenarioPack, SCENARIO_PACKS } from './scenarioPacks';

describe('scenarioPacks', () => {
  it('exposes network-path packs (allocator only, no surplus)', () => {
    expect(SCENARIO_PACKS.map((p) => p.id)).toEqual([
      'close_gap',
      'steady_grind',
      'front_loaded',
    ]);
    expect(getScenarioPack('close_gap').params.priority_power).toBe(1.5);
    expect(getScenarioPack('close_gap').params.trajectory).toBe('uniform');
    expect(getScenarioPack('steady_grind').params.priority_power).toBe(1);
    expect(getScenarioPack('front_loaded').params.trajectory).toBe('front_loaded');
    expect(getScenarioPack('close_gap').params.priority_power).toBeGreaterThan(
      getScenarioPack('steady_grind').params.priority_power,
    );
  });
});
