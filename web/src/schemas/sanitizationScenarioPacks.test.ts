import { describe, expect, it } from 'vitest';

import { pipelineConfigSchema } from './api';
import {
  getSanitizationScenarioPack,
  SANITIZATION_SCENARIO_PACKS,
} from './sanitizationScenarioPacks';

describe('sanitizationScenarioPacks', () => {
  it('exposes three pipeline preset packs', () => {
    expect(SANITIZATION_SCENARIO_PACKS.map((p) => p.id)).toEqual([
      'standard_spec',
      'with_store_month',
      'core_only',
    ]);
    for (const pack of SANITIZATION_SCENARIO_PACKS) {
      expect(() => pipelineConfigSchema.parse(pack.config)).not.toThrow();
    }
    expect(getSanitizationScenarioPack('with_store_month').config.tier4_enabled).toBe(true);
    expect(getSanitizationScenarioPack('core_only').config.tier3_always_five_enabled).toBe(
      false,
    );
    expect(getSanitizationScenarioPack('standard_spec').config.tier4_enabled).toBe(false);
  });
});
