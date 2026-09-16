import { z } from 'zod';

import { defaultPipelineConfig, pipelineConfigSchema, type PipelineConfig } from './api';

/** Flat form fields aligned with SPEC PipelineConfig (four tiers). */
export const configFormSchema = z.object({
  tier1_blacklist_enabled: z.boolean(),
  tier2_freq_enabled: z.boolean(),
  tier3_always_five_enabled: z.boolean(),
  tier4_enabled: z.boolean(),
  tier2_freq_threshold: z.coerce.number().int().min(1).max(20),
  tier4_min_volume: z.coerce.number().int().min(1).max(10_000),
  tier4_z_threshold: z.coerce.number().min(0).max(5),
  tier4_pct_threshold: z.coerce.number().min(0).max(100),
});

export type ConfigFormValues = z.infer<typeof configFormSchema>;

export const defaultConfigFormValues: ConfigFormValues = {
  tier1_blacklist_enabled: defaultPipelineConfig.tier1_blacklist_enabled,
  tier2_freq_enabled: defaultPipelineConfig.tier2_freq_enabled,
  tier3_always_five_enabled: defaultPipelineConfig.tier3_always_five_enabled,
  tier4_enabled: defaultPipelineConfig.tier4_enabled,
  tier2_freq_threshold: defaultPipelineConfig.tier2_freq_threshold,
  tier4_min_volume: defaultPipelineConfig.tier4_min_volume,
  tier4_z_threshold: defaultPipelineConfig.tier4_z_threshold,
  tier4_pct_threshold: defaultPipelineConfig.tier4_pct_threshold,
};

export function toPipelineConfig(values: ConfigFormValues): PipelineConfig {
  return pipelineConfigSchema.parse({
    ...values,
    tier3_always_five_min_n: defaultPipelineConfig.tier3_always_five_min_n,
  });
}
