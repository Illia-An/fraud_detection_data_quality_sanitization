/**
 * TTS plan API contracts. Minutes, lower is better.
 *
 * Numeric bounds must match ``planner.tts_bounds`` / ``GET /api/v1/plans-tts/bounds``
 * (Wave 8 / M-02). Prefer fetching bounds from the API when wiring new UI.
 */

import { z } from 'zod';

/** Mirrors backend ``planner.tts_bounds`` (keep in lockstep until codegen). */
export const TTS_PLAN_HORIZON_MIN = 1;
export const TTS_PLAN_HORIZON_MAX = 12;
export const TTS_PLAN_TARGET_MIN = 0;
export const TTS_PLAN_TARGET_MAX = 30;
export const TTS_PLAN_DEFAULT_TARGET = 3.5;
export const TTS_PLAN_DEFAULT_MAX_MONTHLY = 0.25;

export const ttsPlanBoundsSchema = z.object({
  floor: z.number(),
  ceiling: z.number(),
  default_target: z.number(),
  default_max_monthly_improve: z.number(),
  horizon_min: z.number().int(),
  horizon_max: z.number().int(),
});

export type TtsPlanBounds = z.output<typeof ttsPlanBoundsSchema>;

export const ttsPlanParamsSchema = z.object({
  trajectory: z.enum(['uniform', 'front_loaded', 'accelerated']).default('uniform'),
  trajectory_power: z.number().min(0.1).default(2),
  priority_power: z.number().min(0.1).default(1),
  max_monthly_improve: z.number().min(0.01).default(TTS_PLAN_DEFAULT_MAX_MONTHLY),
  growth_factor: z.number().min(0).max(1).default(0.5),
});

export type TtsPlanParams = z.output<typeof ttsPlanParamsSchema>;

export const ttsPlanBaselineRowSchema = z.object({
  store_id: z.number().int(),
  tts: z.number().min(TTS_PLAN_TARGET_MIN).max(TTS_PLAN_TARGET_MAX),
});

export const ttsPlanRequestSchema = z.object({
  reference_year: z.number().int(),
  reference_month: z.number().int().min(1).max(12),
  horizon: z.number().int().min(TTS_PLAN_HORIZON_MIN).max(TTS_PLAN_HORIZON_MAX).default(12),
  target: z
    .number()
    .min(TTS_PLAN_TARGET_MIN)
    .max(TTS_PLAN_TARGET_MAX)
    .default(TTS_PLAN_DEFAULT_TARGET),
  params: ttsPlanParamsSchema.default({}),
  baseline_rows: z.array(ttsPlanBaselineRowSchema).min(1),
});

export type TtsPlanRequest = z.output<typeof ttsPlanRequestSchema>;

export const ttsMonthScoreSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  score: z.number(),
});

export const ttsPlanSchema = z.object({
  metric_id: z.literal('tts'),
  unit: z.literal('min'),
  direction: z.literal('lower_is_better'),
  target: z.number(),
  current_chain: z.number(),
  required_change: z.number(),
  final_chain: z.number(),
  feasible: z.boolean(),
  chain_trajectory: z.array(ttsMonthScoreSchema),
  projections: z.array(
    z.object({
      store_id: z.number().int(),
      months: z.array(ttsMonthScoreSchema),
    }),
  ),
});

export type TtsPlan = z.output<typeof ttsPlanSchema>;

export const ttsPlanResponseSchema = z.object({
  metrics: z.object({
    tts: ttsPlanSchema,
  }),
});

export type TtsPlanResponse = z.output<typeof ttsPlanResponseSchema>;
