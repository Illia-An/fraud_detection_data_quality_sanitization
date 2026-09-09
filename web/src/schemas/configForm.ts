import { z } from 'zod';

import { defaultPipelineConfig, pipelineConfigSchema, type PipelineConfig } from './api';

/** Flat form fields exposed in the UI (Tier 1 + Tier 2). */
export const configFormSchema = z.object({
  tier1: z.object({
    enable_blacklist: z.boolean(),
    enable_freq_store_day: z.boolean(),
    enable_always_topbox: z.boolean(),
    freq_store_day_min: z.coerce.number().int().min(2).max(20),
  }),
  tier2: z.object({
    enabled: z.boolean(),
    min_volume: z.coerce.number().int().min(1).max(10_000),
    z_high: z.coerce.number().min(0.5).max(5),
    five_pct_min: z.coerce.number().min(50).max(100),
  }),
});

export type ConfigFormValues = z.infer<typeof configFormSchema>;

export const defaultConfigFormValues: ConfigFormValues = {
  tier1: {
    enable_blacklist: defaultPipelineConfig.tier1.enable_blacklist,
    enable_freq_store_day: defaultPipelineConfig.tier1.enable_freq_store_day,
    enable_always_topbox: defaultPipelineConfig.tier1.enable_always_topbox,
    freq_store_day_min: defaultPipelineConfig.tier1.freq_store_day_min,
  },
  tier2: {
    enabled: defaultPipelineConfig.tier2.enabled,
    min_volume: defaultPipelineConfig.tier2.min_volume,
    z_high: defaultPipelineConfig.tier2.z_high,
    five_pct_min: defaultPipelineConfig.tier2.five_pct_min,
  },
};

export function toPipelineConfig(values: ConfigFormValues): PipelineConfig {
  return pipelineConfigSchema.parse({
    tier1: {
      ...values.tier1,
      always_topbox_min_n: defaultPipelineConfig.tier1.always_topbox_min_n,
      customer_blacklist_value: defaultPipelineConfig.tier1.customer_blacklist_value,
    },
    tier2: values.tier2,
  });
}
