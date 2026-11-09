/** Cumulative-slope plan versions & simulation API (SPEC-P001 Phase 2/3). */

import { z } from 'zod';

export const yearMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export const monthScoreSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  score: z.number(),
});

export const storeMonthFactSchema = z.object({
  store_id: z.number().int(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  five_percent: z.number().min(0).max(100),
});

export const networkPlanParamsSchema = z.object({
  history_cap_mode: z.enum(['max_mom', 'p95_mom', 'best_window']).default('max_mom'),
  plateau_ahead_pp: z.number().min(0).default(2),
  mild_rate: z.number().min(0).default(0.5),
  boost_gain: z.number().min(0).default(0.15),
  min_history_cap: z.number().min(0).default(0.25),
  floor: z.number().min(0).default(0),
  ceiling: z.number().min(0).max(100).default(100),
});

export type NetworkPlanParamsIn = z.input<typeof networkPlanParamsSchema>;

export const planVersionCreateRequestSchema = z.object({
  label: z.string().nullable().optional(),
  network_target: z.number().min(0).max(100).default(75),
  as_of: yearMonthSchema,
  planning_year: z.number().int(),
  cumulative_start: yearMonthSchema.default({ year: 2025, month: 1 }),
  solver: z.literal('cumulative_slope').default('cumulative_slope'),
  params: networkPlanParamsSchema.default({}),
  facts: z.array(storeMonthFactSchema).min(1),
});

export type PlanVersionCreateRequest = z.input<typeof planVersionCreateRequestSchema>;

export const simulationRequestSchema = z.object({
  network_target: z.number().min(0).max(100).default(75),
  as_of: yearMonthSchema,
  planning_year: z.number().int(),
  cumulative_start: yearMonthSchema.default({ year: 2025, month: 1 }),
  solver: z.literal('cumulative_slope').default('cumulative_slope'),
  params: networkPlanParamsSchema.default({}),
  active_plan_version_id: z.string().nullable().optional(),
  facts: z.array(storeMonthFactSchema).min(1),
});

export type SimulationRequest = z.input<typeof simulationRequestSchema>;

export const simulationAdjustRequestSchema = simulationRequestSchema.extend({
  adjustments: z
    .array(
      z.object({
        store_id: z.number().int(),
        new_implied_target: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

export type SimulationAdjustRequest = z.input<typeof simulationAdjustRequestSchema>;

export const storeCurvesSchema = z.object({
  store_id: z.number().int(),
  monthly_target: z.array(monthScoreSchema),
  cumulative_planned: z.array(monthScoreSchema),
  actual: z.array(monthScoreSchema),
  cumulative_actual: z.array(monthScoreSchema),
  simulation: z.array(monthScoreSchema),
  cumulative_actual_or_simulation: z.array(monthScoreSchema),
  implied_target: z.number(),
  gap_to_mean: z.number(),
  slope: z.number(),
  unreachable: z.boolean(),
  suggested_implied_target: z.number().nullable(),
  capped: z.boolean(),
});

export const unreachableHintSchema = z.object({
  store_id: z.number().int(),
  implied_target: z.number(),
  suggested_implied_target: z.number(),
  reason: z.string(),
  network_impact_pp: z.number(),
});

export const simulationResponseSchema = z.object({
  as_of: yearMonthSchema,
  planning_year: z.number().int(),
  active_plan_version_id: z.string().nullable(),
  network: z.object({
    network_target: z.number(),
    network_mean_as_of: z.number(),
    projected_network_mean_eoy: z.number(),
    feasible: z.boolean(),
    store_count: z.number().int(),
  }),
  stores: z.array(storeCurvesSchema),
  unreachable: z.array(unreachableHintSchema),
});

export type SimulationResponse = z.output<typeof simulationResponseSchema>;

export const planVersionMetaSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  label: z.string().nullable(),
  metric_id: z.string(),
  direction: z.string(),
  solver: z.string(),
  network_target: z.number(),
  as_of: yearMonthSchema,
  planning_year: z.number().int(),
  cumulative_start: yearMonthSchema,
  network_mean_at_save: z.number(),
  params: networkPlanParamsSchema,
});

export const planVersionResponseSchema = z.object({
  meta: planVersionMetaSchema,
  stores: z.array(
    z.object({
      store_id: z.number().int(),
      monthly_target: z.array(monthScoreSchema),
      implied_target: z.number(),
      cumulative_planned: z.array(monthScoreSchema),
    }),
  ),
  network_monthly_target: z.array(monthScoreSchema),
  network_cumulative_planned: z.array(monthScoreSchema),
});

export type PlanVersionResponse = z.output<typeof planVersionResponseSchema>;

export const planVersionListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      created_at: z.string(),
      label: z.string().nullable(),
      network_target: z.number(),
      as_of: yearMonthSchema,
      planning_year: z.number().int(),
      solver: z.string(),
      network_mean_at_save: z.number(),
      store_count: z.number().int(),
      metric_id: z.string().default('five_percent'),
    }),
  ),
});

export type PlanVersionListResponse = z.output<typeof planVersionListResponseSchema>;
