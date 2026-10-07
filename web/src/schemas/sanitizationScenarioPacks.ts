/**
 * Preset questions for Survey Sanitization — each pack is a question + PipelineConfig recipe.
 * One click: set tiers/thresholds + Run; canvas KPI/chart is the answer (session only).
 */

import { defaultPipelineConfig, pipelineConfigSchema, type PipelineConfig } from './api';

export type SanitizationScenarioPackId = 'standard_spec' | 'with_store_month' | 'core_only';

export interface SanitizationScenarioPackRecipe {
  id: SanitizationScenarioPackId;
  config: PipelineConfig;
}

export const SANITIZATION_SCENARIO_PACKS: readonly SanitizationScenarioPackRecipe[] = [
  {
    id: 'standard_spec',
    config: defaultPipelineConfig,
  },
  {
    id: 'with_store_month',
    config: pipelineConfigSchema.parse({
      ...defaultPipelineConfig,
      tier4_enabled: true,
    }),
  },
  {
    id: 'core_only',
    config: pipelineConfigSchema.parse({
      ...defaultPipelineConfig,
      tier3_always_five_enabled: false,
    }),
  },
] as const;

export function getSanitizationScenarioPack(
  id: SanitizationScenarioPackId,
): SanitizationScenarioPackRecipe {
  const pack = SANITIZATION_SCENARIO_PACKS.find((p) => p.id === id);
  if (!pack) {
    throw new Error(`Unknown sanitization scenario pack: ${id}`);
  }
  return pack;
}
