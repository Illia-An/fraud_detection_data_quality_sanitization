import { describe, expect, it } from 'vitest';

import { computeNetworkSlack } from './plannerSlack';

describe('computeNetworkSlack', () => {
  it('reports remaining slack and partial progress when improving toward target', () => {
    const slack = computeNetworkSlack(80, 70, 75);
    expect(slack.remainingPp).toBeCloseTo(5, 5);
    expect(slack.gapPp).toBeCloseTo(10, 5);
    expect(slack.progress01).toBeCloseTo(0.5, 5);
    expect(slack.statusLabel).toMatch(/5\.0 pp slack to target/);
  });

  it('marks ahead of target when projected exceeds goal', () => {
    const slack = computeNetworkSlack(75, 70, 78);
    expect(slack.remainingPp).toBeCloseTo(-3, 5);
    expect(slack.progress01).toBe(1);
    expect(slack.statusLabel).toMatch(/3\.0 pp ahead of target/);
  });

  it('reports at target when projected matches goal', () => {
    const slack = computeNetworkSlack(75, 70, 75);
    expect(slack.remainingPp).toBeCloseTo(0, 5);
    expect(slack.progress01).toBeCloseTo(1, 5);
    expect(slack.statusLabel).toBe('At target');
  });
});
