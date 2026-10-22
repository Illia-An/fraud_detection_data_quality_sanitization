/** TTS plan API contracts. Minutes, lower is better. */

import { z } from 'zod';

export const TTS_PLAN_HORIZON_MIN = 1;
export const TTS_PLAN_HORIZON_MAX = 12;
export const TTS_PLAN_TARGET_MIN = 0;
export const TTS_PLAN_TARGET_MAX = 30;

export const ttsPlanParamsSchema = z.object({
  trajectory: z.enum(['uniform', 'front_loaded', 'accelerated']).default('uniform'),
  trajectory_power: z.number().min(0.1).default(2),
  priority_power: z.number().min(0.1).default(1),
  max_monthly_improve: z.number().min(0.01).default(0.25),
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
  target: z.number().min(TTS_PLAN_TARGET_MIN).max(TTS_PLAN_TARGET_MAX).default(3.5),
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
