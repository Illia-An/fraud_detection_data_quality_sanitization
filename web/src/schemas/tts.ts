/**
 * Zod mirror of SPEC-tts.md Section 2 + Stage 3 API contracts.
 * Isolated from Q10012 schemas in api.ts.
 */
import { z } from 'zod';

export const ttsSamplePresetSchema = z.enum(['small', 'medium', 'stress']);
export type TtsSamplePreset = z.infer<typeof ttsSamplePresetSchema>;

/** Synthetic presets plus SQL Server TTS source. */
export const ttsDataSourceSchema = z.enum(['small', 'medium', 'stress', 'db']);
export type TtsDataSource = z.infer<typeof ttsDataSourceSchema>;

export const orderAggSchema = z.enum(['none', 'avg', 'max']);
export type OrderAgg = z.infer<typeof orderAggSchema>;

export const ttsPipelineConfigSchema = z.object({
  tts_min_sec: z.number().int().min(0).default(30),
  order_agg: orderAggSchema.default('none'),
});

export type TtsPipelineConfig = z.output<typeof ttsPipelineConfigSchema>;

export const defaultTtsPipelineConfig: TtsPipelineConfig = ttsPipelineConfigSchema.parse({});

export const ttsBumpRowSchema = z
  .object({
    StoreIndex: z.number().int(),
    SaleDate: z.union([z.string(), z.number()]),
    WeborderID: z.string(),
    UpDatetime: z.string(),
    BumpDateTime: z.string().nullable().optional(),
    KVSGroup: z.number().int().nullable().optional(),
    MeitNumber: z.number().int().nullable().optional(),
    SortOrder: z.number().int().nullable().optional(),
  })
  .passthrough();

export type TtsBumpRow = z.infer<typeof ttsBumpRowSchema>;

export const ttsProcessRequestSchema = z
  .object({
    source: z.enum(['inline', 'db']).default('db'),
    rows: z.array(ttsBumpRowSchema).max(2_000_000).default([]),
    config: ttsPipelineConfigSchema.default({}),
    from_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    to_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    store_ids: z.array(z.number().int()).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.source === 'inline' && value.rows.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rows must not be empty',
        path: ['rows'],
      });
    }
    if (value.from_date && value.to_date && value.from_date > value.to_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from_date must be on or before to_date',
        path: ['to_date'],
      });
    }
  });

export type TtsProcessRequest = z.output<typeof ttsProcessRequestSchema>;

export const ttsStepNameSchema = z.enum(['actual', 'ge30']);
export type TtsStepName = z.infer<typeof ttsStepNameSchema>;

export const TTS_STEP_LABELS: Record<TtsStepName, string> = {
  actual: 'Actual (baseline)',
  ge30: 'ge30 (≥ min sec)',
};

export const ttsStepMetricSchema = z.object({
  step_name: ttsStepNameSchema,
  rows_in: z.number().int().min(0),
  rows_out: z.number().int().min(0),
  rows_dropped: z.number().int().min(0),
  mean_tts_sec: z.number(),
  median_tts_sec: z.number().nullable().optional(),
});

export type TtsStepMetric = z.output<typeof ttsStepMetricSchema>;

export const ttsStoreImpactPointSchema = z.object({
  store_id: z.number(),
  year: z.number().int(),
  month: z.number().int(),
  actual_mean_tts_sec: z.number().nullable().optional(),
  after_ge30_mean_tts_sec: z.number().nullable().optional(),
  volume_before: z.number().int().nullable().optional(),
  volume_after: z.number().int().nullable().optional(),
});

export type TtsStoreImpactPoint = z.output<typeof ttsStoreImpactPointSchema>;

export const ttsResponseMetaSchema = z
  .object({
    execution_time_ms: z.number().optional(),
    peak_memory_mb: z.number().optional(),
    rows_scanned: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const ttsSanitizationResponseSchema = z.object({
  baseline_mean_tts_sec: z.number(),
  final_mean_tts_sec: z.number(),
  network_delta_sec: z.number(),
  steps: z.array(ttsStepMetricSchema).default([]),
  store_impact_series: z.array(ttsStoreImpactPointSchema).default([]),
  echo_config: ttsPipelineConfigSchema,
  meta: ttsResponseMetaSchema,
});

export type TtsSanitizationResponse = z.output<typeof ttsSanitizationResponseSchema>;

export const ttsSamplePresetMetaSchema = z.object({
  preset: z.string(),
  row_count: z.number().int(),
  store_count: z.number().int(),
  month_count: z.number().int(),
  description: z.string(),
});

export type TtsSamplePresetMeta = z.infer<typeof ttsSamplePresetMetaSchema>;

export const ttsSampleResponseSchema = z.object({
  preset: z.string(),
  rows: z.array(ttsBumpRowSchema),
  meta: ttsSamplePresetMetaSchema,
});

export type TtsSampleResponse = z.infer<typeof ttsSampleResponseSchema>;

const TTS_STEP_ORDER: Record<TtsStepName, number> = {
  actual: 0,
  ge30: 1,
};

export function sortTtsSteps<T extends { step_name: TtsStepName }>(steps: T[]): T[] {
  return [...steps].sort((a, b) => TTS_STEP_ORDER[a.step_name] - TTS_STEP_ORDER[b.step_name]);
}

export function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
