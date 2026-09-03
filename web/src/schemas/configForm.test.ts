import { describe, expect, it } from 'vitest';

import {
  configFormSchema,
  defaultConfigFormValues,
  toPipelineConfig,
} from './configForm';
import { pipelineConfigSchema } from './api';

describe('configFormSchema', () => {
  it('maps default form values to a valid PipelineConfig', () => {
    const parsed = configFormSchema.parse(defaultConfigFormValues);
    const config = toPipelineConfig(parsed);
    expect(pipelineConfigSchema.safeParse(config).success).toBe(true);
    expect(config.tier1.freq_store_day_min).toBe(3);
    expect(config.tier2.enabled).toBe(true);
    expect(config.tier2.min_volume).toBe(30);
    expect(config.tier3.enabled).toBe(false);
    expect(config.tier3.contamination).toBe(0.005);
  });

  it('preserves hidden backend defaults', () => {
    const config = toPipelineConfig(defaultConfigFormValues);
    expect(config.tier1.customer_blacklist_value).toBe('לא');
    expect(config.tier3.n_estimators).toBe(200);
  });
});
