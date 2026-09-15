import { z } from 'zod';

import { defaultPipelineConfig, pipelineConfigSchema, type PipelineConfig } from './api';

/** Flat form fields aligned with SPEC PipelineConfig (no Tier2 on/off). */
export const configFormSchema = z.object({
  tier1_blacklist_enabled: z.boolean(),
  tier1_freq_enabled: z.boolean(),
  tier1_always_five_enabled: z.boolean(),
  tier1_freq_threshold: z.coerce.number().int().min(1).max(20),
  tier2_min_volume: z.coerce.number().int().min(1).max(10_000),
  tier2_z_threshold: z.coerce.number().min(0).max(5),
  tier2_pct_threshold: z.coerce.number().min(0).max(100),
});

export type ConfigFormValues = z.infer<typeof configFormSchema>;

export const defaultConfigFormValues: ConfigFormValues = {
  tier1_blacklist_enabled: defaultPipelineConfig.tier1_blacklist_enabled,
  tier1_freq_enabled: defaultPipelineConfig.tier1_freq_enabled,
  tier1_always_five_enabled: defaultPipelineConfig.tier1_always_five_enabled,
  tier1_freq_threshold: defaultPipelineConfig.tier1_freq_threshold,
  tier2_min_volume: defaultPipelineConfig.tier2_min_volume,
  tier2_z_threshold: defaultPipelineConfig.tier2_z_threshold,
  tier2_pct_threshold: defaultPipelineConfig.tier2_pct_threshold,
};

export function toPipelineConfig(values: ConfigFormValues): PipelineConfig {
  return pipelineConfigSchema.parse({
    ...values,
    tier1_always_five_min_n: defaultPipelineConfig.tier1_always_five_min_n,
  });
}
