/**
 * Zod mirror of backend/schemas.py — keep JSON field names identical.
 */
import { z } from 'zod';

export const samplePresetSchema = z.enum(['small', 'medium', 'stress']);
export type SamplePreset = z.infer<typeof samplePresetSchema>;

export const surveyAnswerRowSchema = z
  .object({
    ParticipateNumber: z.string().nullable().optional(),
    Question_ID: z.number().int().min(1).optional(),
    Answer_Value: z.number().int().min(1).max(5).nullable().optional(),
    BlackList: z.string().nullable().optional(),
    UserContact: z.string().nullable().optional(),
    PhoneFromLog: z.string().nullable().optional(),
    ext_user_id: z.number().int().nullable().optional(),
    PrintStore: z.number().nullable().optional(),
    AnswerTime: z.string().nullable().optional(),
    PrintDateTime: z.string().nullable().optional(),
    Year: z.number().int().min(2000).max(2100).nullable().optional(),
    Month: z.number().int().min(1).max(12).nullable().optional(),
  })
  .passthrough();

export type SurveyAnswerRow = z.infer<typeof surveyAnswerRowSchema>;

export const tier1OptionsSchema = z.object({
  enable_blacklist: z.boolean().default(true),
  enable_freq_store_day: z.boolean().default(true),
  enable_always_topbox: z.boolean().default(false),
  freq_store_day_min: z.number().int().min(2).max(20).default(3),
  always_topbox_min_n: z.number().int().min(3).max(100).default(10),
  customer_blacklist_value: z.string().default('לא'),
});

export const tier2OptionsSchema = z.object({
  enabled: z.boolean().default(true),
  min_volume: z.number().int().min(1).max(10_000).default(30),
  z_high: z.number().min(0.5).max(5).default(2),
  five_pct_min: z.number().min(50).max(100).default(90),
});

export const tier3OptionsSchema = z.object({
  enabled: z.boolean().default(false),
  contamination: z.number().min(0.001).max(0.1).default(0.005),
  min_entity_n: z.number().int().min(2).max(50).default(3),
  n_estimators: z.number().int().min(50).max(500).default(200),
  random_state: z.number().int().min(0).default(42),
});

export const pipelineConfigSchema = z.object({
  tier1: tier1OptionsSchema.default({}),
  tier2: tier2OptionsSchema.default({}),
  tier3: tier3OptionsSchema.default({}),
});

export type PipelineConfig = z.output<typeof pipelineConfigSchema>;

export const defaultPipelineConfig: PipelineConfig = pipelineConfigSchema.parse({});

export const processRequestSchema = z.object({
  rows: z.array(surveyAnswerRowSchema).min(1).max(500_000),
  config: pipelineConfigSchema.default({}),
});

export type ProcessRequest = z.output<typeof processRequestSchema>;

export const stepMetricsSchema = z.object({
  step_name: z.string(),
  rows_in: z.number().int().min(0),
  rows_out: z.number().int().min(0),
  rows_dropped: z.number().int().min(0),
  top_box_rate_pct: z.number().nullable().optional(),
  drop_reasons: z.record(z.string(), z.number().int()).default({}),
});

export const storeMonthCellSchema = z.object({
  store_id: z.number(),
  year: z.number().int(),
  month: z.number().int(),
  volume: z.number().int().min(0),
  five_pct: z.number(),
  z: z.number(),
  flagged: z.boolean().default(false),
});

export const storeImpactPointSchema = z.object({
  store_id: z.number(),
  year: z.number().int(),
  month: z.number().int(),
  period_label: z.string(),
  actual_five_pct: z.number(),
  after_tier1_five_pct: z.number().nullable().optional(),
  after_tier2_five_pct: z.number().nullable().optional(),
  after_tier3_five_pct: z.number().nullable().optional(),
  actual_volume: z.number().int().min(0),
  final_volume: z.number().int().min(0),
  rows_dropped: z.number().int().min(0),
});

export const processResponseSchema = z.object({
  baseline_top_box_pct: z.number().nullable().optional(),
  final_top_box_pct: z.number().nullable().optional(),
  network_delta_pp: z.number().nullable().optional(),
  steps: z.array(stepMetricsSchema).default([]),
  high_store_months: z.array(storeMonthCellSchema).default([]),
  store_impact_series: z.array(storeImpactPointSchema).default([]),
  entities_flagged_tier3: z.number().int().min(0).default(0),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export type ProcessResponse = z.output<typeof processResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const samplePresetMetaSchema = z.object({
  preset: z.string(),
  row_count: z.number().int(),
  store_count: z.number().int(),
  month_count: z.number().int(),
  description: z.string(),
});

export const sampleResponseSchema = z.object({
  preset: z.string(),
  rows: z.array(surveyAnswerRowSchema),
  meta: samplePresetMetaSchema,
});

export type SampleResponse = z.infer<typeof sampleResponseSchema>;

export const errorDetailSchema = z.object({
  detail: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

export type StepMetrics = z.output<typeof stepMetricsSchema>;
export type StoreMonthCell = z.output<typeof storeMonthCellSchema>;
export type StoreImpactPoint = z.output<typeof storeImpactPointSchema>;
export type Tier1Options = z.output<typeof tier1OptionsSchema>;
export type Tier2Options = z.output<typeof tier2OptionsSchema>;
export type Tier3Options = z.output<typeof tier3OptionsSchema>;
