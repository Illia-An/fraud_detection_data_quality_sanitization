import { describe, expect, it } from 'vitest';

import {
  configFormSchema,
  defaultConfigFormValues,
  toPipelineConfig,
} from './configForm';

describe('configFormSchema', () => {
  it('maps form values to flat SPEC PipelineConfig', () => {
    const config = toPipelineConfig(defaultConfigFormValues);
    expect(config.tier1_blacklist_enabled).toBe(true);
    expect(config.tier2_freq_enabled).toBe(true);
    expect(config.tier2_freq_threshold).toBe(3);
    expect(config.tier4_enabled).toBe(true);
    expect(config.tier4_min_volume).toBe(30);
  });

  it('accepts updated freq threshold', () => {
    const parsed = configFormSchema.parse({
      ...defaultConfigFormValues,
      tier2_freq_threshold: 5,
    });
    expect(toPipelineConfig(parsed).tier2_freq_threshold).toBe(5);
  });

  it('preserves freq enabled flag', () => {
    const parsed = configFormSchema.parse({
      ...defaultConfigFormValues,
      tier2_freq_enabled: false,
    });
    expect(toPipelineConfig(parsed).tier2_freq_enabled).toBe(false);
  });
});
