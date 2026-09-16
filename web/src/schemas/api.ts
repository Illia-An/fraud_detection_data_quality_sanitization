/**
 * Zod mirror of SPEC.md Section 2 + Section 5.3 meta telemetry.
 * Layout: web/src (project frontend root).
 */
import { z } from 'zod';

export const samplePresetSchema = z.enum(['small', 'medium', 'stress']);
export type SamplePreset = z.infer<typeof samplePresetSchema>;

/** Synthetic presets plus SQL Server sample source. */
export const dataSourceSchema = z.enum(['small', 'medium', 'stress', 'db']);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const sampleDbParamsSchema = z.object({
  store: z.number().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

export type SampleDbParams = z.input<typeof sampleDbParamsSchema>;

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

const LEGACY_CONFIG_KEY_MAP: ReadonlyArray<readonly [string, string]> = [
  ['tier1_freq_enabled', 'tier2_freq_enabled'],
  ['tier1_freq_threshold', 'tier2_freq_threshold'],
  ['tier1_always_five_enabled', 'tier3_always_five_enabled'],
  ['tier1_always_five_min_n', 'tier3_always_five_min_n'],
  ['tier2_min_volume', 'tier4_min_volume'],
  ['tier2_z_threshold', 'tier4_z_threshold'],
  ['tier2_pct_threshold', 'tier4_pct_threshold'],
];

/** Map pre-split-tier request keys to the four-tier PipelineConfig shape. */
export function migrateLegacyPipelineConfig(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data };
  for (const [oldKey, newKey] of LEGACY_CONFIG_KEY_MAP) {
    if (oldKey in out && !(newKey in out)) {
      out[newKey] = out[oldKey];
    }
  }
  return out;
}

/** Flat PipelineConfig — SPEC Section 2 (four independent tiers). */
export const pipelineConfigSchema = z.preprocess(
  (value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? migrateLegacyPipelineConfig(value as Record<string, unknown>)
      : value,
  z.object({
    tier1_blacklist_enabled: z.boolean().default(true),
    tier2_freq_enabled: z.boolean().default(true),
    tier2_freq_threshold: z.number().int().min(1).default(3),
    tier3_always_five_enabled: z.boolean().default(false),
    tier3_always_five_min_n: z.number().int().min(1).default(10),
    tier4_enabled: z.boolean().default(true),
    tier4_min_volume: z.number().int().min(1).default(30),
    tier4_z_threshold: z.number().min(0).default(2.0),
    tier4_pct_threshold: z.number().min(0).max(100).default(90.0),
  }),
);

export type PipelineConfig = z.output<typeof pipelineConfigSchema>;

export const defaultPipelineConfig: PipelineConfig = pipelineConfigSchema.parse({});

export const processRequestSchema = z
  .object({
    source: z.enum(['inline', 'db']).default('inline'),
    rows: z.array(surveyAnswerRowSchema).max(500_000).default([]),
    config: pipelineConfigSchema.default({}),
  })
  .superRefine((value, ctx) => {
    if (value.source === 'inline' && value.rows.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rows must not be empty',
        path: ['rows'],
      });
    }
  });

export type ProcessRequest = z.output<typeof processRequestSchema>;

export const stepNameSchema = z.enum(['actual', 'tier1', 'tier2', 'tier3', 'tier4']);
export type StepName = z.infer<typeof stepNameSchema>;

/** Human-readable labels for Pipeline steps table / chart legend. */
export const PIPELINE_STEP_LABELS: Record<StepName, string> = {
  actual: 'Actual (baseline)',
  tier1: 'Tier 1 — BlackList',
  tier2: 'Tier 2 — Frequency',
  tier3: 'Tier 3 — Always top-box',
  tier4: 'Tier 4 — Store×month',
};

export function formatPipelineStepLabel(stepName: StepName): string {
  return PIPELINE_STEP_LABELS[stepName] ?? stepName;
}

export const stepMetricsSchema = z.object({
  step_name: stepNameSchema,
  rows_in: z.number().int().min(0),
  rows_out: z.number().int().min(0),
  rows_dropped: z.number().int().min(0),
  top_box_pct: z.number(),
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
  after_tier4_five_pct: z.number().nullable().optional(),
  actual_volume: z.number().int().min(0),
  final_volume: z.number().int().min(0),
  rows_dropped: z.number().int().min(0),
});

/** SPEC §5.3 profiling keys — required on /process responses. */
export const responseMetaSchema = z
  .object({
    execution_time_ms: z.number(),
    peak_memory_mb: z.number(),
    rows_scanned: z.number().int().nonnegative(),
    db_query_a_time_ms: z.number().optional(),
    db_query_b_time_ms: z.number().optional(),
  })
  .passthrough();

export type ResponseMeta = z.output<typeof responseMetaSchema>;

const STEP_ORDER: Record<StepName, number> = {
  actual: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
  tier4: 4,
};

/** Deterministic actual → tier1 → tier2 → tier3 → tier4 ordering. */
export function sortPipelineSteps<T extends { step_name: StepName }>(steps: T[]): T[] {
  return [...steps].sort(
    (a, b) => STEP_ORDER[a.step_name] - STEP_ORDER[b.step_name],
  );
}

export const sanitizationResponseSchema = z.object({
  baseline_top_box_pct: z.number(),
  final_top_box_pct: z.number(),
  network_delta_pp: z.number(),
  steps: z.array(stepMetricsSchema).default([]),
  high_store_months: z.array(storeMonthCellSchema).default([]),
  store_impact_series: z.array(storeImpactPointSchema).default([]),
  echo_config: pipelineConfigSchema,
  meta: responseMetaSchema,
});

export type SanitizationResponse = z.output<typeof sanitizationResponseSchema>;

/** @deprecated Prefer SanitizationResponse — kept for gradual rename. */
export type ProcessResponse = SanitizationResponse;
export const processResponseSchema = sanitizationResponseSchema;

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
export type SamplePresetMeta = z.infer<typeof samplePresetMetaSchema>;

export const errorDetailSchema = z.object({
  detail: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

export type StepMetrics = z.output<typeof stepMetricsSchema>;
export type StoreMonthCell = z.output<typeof storeMonthCellSchema>;
export type StoreImpactPoint = z.output<typeof storeImpactPointSchema>;
