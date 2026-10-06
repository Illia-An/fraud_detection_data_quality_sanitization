/** Plan API contracts — TASK-15 Phase A (five_percent only). */

import { z } from 'zod';

/** Goal levers — horizon capped at one year (product sense). */
export const PLAN_HORIZON_MIN = 1;
export const PLAN_HORIZON_MAX = 12;
export const PLAN_TARGET_MIN = 0;
export const PLAN_TARGET_MAX = 100;

export function clampPlanHorizon(raw: string | number, fallback = PLAN_HORIZON_MAX): number {
  const n =
    typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (typeof raw === 'string' && String(raw).trim() === '') {
    return Math.min(PLAN_HORIZON_MAX, Math.max(PLAN_HORIZON_MIN, Math.round(fallback)));
  }
  if (!Number.isFinite(n)) {
    return Math.min(PLAN_HORIZON_MAX, Math.max(PLAN_HORIZON_MIN, Math.round(fallback)));
  }
  return Math.min(PLAN_HORIZON_MAX, Math.max(PLAN_HORIZON_MIN, Math.round(n)));
}

export function clampPlanTarget(raw: string | number, fallback = 75): number {
  if (typeof raw === 'string' && String(raw).trim() === '') {
    return Math.min(PLAN_TARGET_MAX, Math.max(PLAN_TARGET_MIN, fallback));
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return Math.min(PLAN_TARGET_MAX, Math.max(PLAN_TARGET_MIN, fallback));
  }
  const clamped = Math.min(PLAN_TARGET_MAX, Math.max(PLAN_TARGET_MIN, n));
  return Math.round(clamped * 10) / 10;
}

export const planParamsSchema = z.object({
  trajectory: z.enum(['uniform', 'front_loaded', 'accelerated']).default('uniform'),
  trajectory_power: z.number().min(0.1).default(2),
  priority_power: z.number().min(0.1).default(1),
  max_monthly_improve: z.number().min(0.01).default(4),
  growth_factor: z.number().min(0).max(1).default(0.5),
});

export type PlanParams = z.output<typeof planParamsSchema>;

export const planBaselineRowSchema = z.object({
  store_id: z.number().int(),
  five_percent: z.number().min(0).max(100),
});

export const planRequestSchema = z.object({
  reference_year: z.number().int(),
  reference_month: z.number().int().min(1).max(12),
  horizon: z
    .number()
    .int()
    .min(PLAN_HORIZON_MIN)
    .max(PLAN_HORIZON_MAX)
    .default(12),
  target: z.number().min(PLAN_TARGET_MIN).max(PLAN_TARGET_MAX).default(75),
  params: planParamsSchema.default({}),
  baseline_rows: z.array(planBaselineRowSchema).min(1),
});

export type PlanRequest = z.output<typeof planRequestSchema>;

export const monthScoreSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  score: z.number(),
});

export type MonthScore = z.output<typeof monthScoreSchema>;

export const storeProjectionSchema = z.object({
  store_id: z.number().int(),
  months: z.array(monthScoreSchema),
});

export const fivePercentPlanSchema = z.object({
  metric_id: z.literal('five_percent'),
  unit: z.literal('%'),
  direction: z.literal('higher_is_better'),
  target: z.number(),
  current_chain: z.number(),
  required_change: z.number(),
  final_chain: z.number(),
  feasible: z.boolean(),
  chain_trajectory: z.array(monthScoreSchema),
  projections: z.array(storeProjectionSchema),
});

export type FivePercentPlan = z.output<typeof fivePercentPlanSchema>;

export const planResponseSchema = z.object({
  metrics: z.object({
    five_percent: fivePercentPlanSchema,
  }),
});

export type PlanResponse = z.output<typeof planResponseSchema>;

export const DEFAULT_PLAN_PARAMS: PlanParams = {
  trajectory: 'uniform',
  trajectory_power: 2,
  priority_power: 1,
  max_monthly_improve: 4,
  growth_factor: 0.5,
};

export function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** HSL green-better heatmap cell (azure-blue friendly). */
export function heatmapCellColor(
  score: number | null,
  min: number,
  max: number,
): string {
  if (score == null || Number.isNaN(score)) {
    return '#f5f5f5';
  }
  const span = Math.max(max - min, 1e-6);
  const t = Math.min(1, Math.max(0, (score - min) / span));
  const hue = 120 * t;
  const lightness = 88 - t * 28;
  return `hsl(${hue} 55% ${lightness}%)`;
}

export function collectHeatmapScores(plan: FivePercentPlan): number[] {
  const values: number[] = [];
  for (const point of plan.chain_trajectory) {
    values.push(point.score);
  }
  for (const projection of plan.projections) {
    for (const point of projection.months) {
      values.push(point.score);
    }
  }
  return values;
}
