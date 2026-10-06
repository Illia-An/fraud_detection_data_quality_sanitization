import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/messages/en';
import { DEFAULT_PLAN_PARAMS } from '../../schemas/plan';
import { formatPathLeversSummary } from './plannerPathLeversSummary';

const t = (key: keyof typeof en, params?: Record<string, string | number>): string => {
  let s: string = en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
};

describe('formatPathLeversSummary', () => {
  it('summarizes uniform path without advanced suffix', () => {
    const line = formatPathLeversSummary(DEFAULT_PLAN_PARAMS, t);
    expect(line).toContain('Uniform');
    expect(line).toContain('priority 1');
    expect(line).not.toContain('trajectory power');
  });

  it('appends trajectory power for shaped paths', () => {
    const line = formatPathLeversSummary(
      { ...DEFAULT_PLAN_PARAMS, trajectory: 'front_loaded', trajectory_power: 2 },
      t,
    );
    expect(line).toContain('Front-loaded');
    expect(line).toContain('trajectory power 2');
  });
});
