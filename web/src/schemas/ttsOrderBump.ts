/**
 * Zod mirror of Order × Bump API (isolated from McKiti TTS schemas).
 */
import { z } from 'zod';

export const orderBumpPresetSchema = z.enum(['small', 'medium', 'stress']);
export type OrderBumpPreset = z.infer<typeof orderBumpPresetSchema>;

export const orderBumpPipelineConfigSchema = z.object({
  tts_min_sec: z.number().min(0).default(30),
});

export type OrderBumpPipelineConfig = z.output<typeof orderBumpPipelineConfigSchema>;

export const defaultOrderBumpPipelineConfig: OrderBumpPipelineConfig =
  orderBumpPipelineConfigSchema.parse({});

export const orderBumpRowSchema = z
  .object({
    store_id: z.number().int(),
    sale_date: z.string(),
    order_id: z.string(),
    order_key: z.string(),
    bump_seq: z.number().int(),
    bump_uid: z.string(),
    order_tts_sec: z.number(),
    order_is_void: z.boolean().optional(),
    bump_tts_sec: z.number().nullable().optional(),
    bump_valid: z.boolean().optional(),
    bump_ge30: z.boolean().optional(),
    join_match: z.boolean().optional(),
    year: z.number().int(),
    month: z.number().int(),
  })
  .passthrough();

export type OrderBumpRow = z.infer<typeof orderBumpRowSchema>;

export const orderBumpProcessRequestSchema = z
  .object({
    source: z.enum(['inline', 'db']).default('inline'),
    rows: z.array(orderBumpRowSchema).max(2_000_000).default([]),
    config: orderBumpPipelineConfigSchema.default({}),
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

export type OrderBumpProcessRequest = z.output<typeof orderBumpProcessRequestSchema>;

export const orderBumpKpiSchema = z.object({
  pct_bumps_dropped_lt30: z.number().nullable().optional(),
  bump_mean_raw_sec: z.number().nullable().optional(),
  bump_mean_ge30_sec: z.number().nullable().optional(),
  kitchen_mean_raw_sec: z.number().nullable().optional(),
  kitchen_mean_ge30_sec: z.number().nullable().optional(),
  cycle_mean_sec: z.number().nullable().optional(),
  pct_orders_excluded_ge30: z.number().nullable().optional(),
  order_tts_penalty_sec: z.number().default(0),
  order_tts_weight: z.number().default(1),
  order_tts_mean_sec: z.number().nullable().optional(),
  order_tts_mean_after_sec: z.number().nullable().optional(),
  order_count: z.number().int().default(0),
  order_count_raw: z.number().int().default(0),
  order_count_ge30: z.number().int().default(0),
  order_count_cycle: z.number().int().default(0),
  bump_valid_count: z.number().int().default(0),
  bump_ge30_count: z.number().int().default(0),
  bump_lt30_count: z.number().int().default(0),
});

export type OrderBumpKpi = z.output<typeof orderBumpKpiSchema>;

export const orderBumpStoreMonthSchema = z.object({
  store_id: z.number(),
  year: z.number().int(),
  month: z.number().int(),
  order_count: z.number().int(),
  order_tts_mean_sec: z.number(),
  order_tts_mean_after_sec: z.number(),
  order_tts_median_sec: z.number().nullable().optional(),
  bump_volume: z.number().int(),
  bump_volume_ge30: z.number().int(),
  bump_mean_raw_sec: z.number().nullable().optional(),
  bump_mean_ge30_sec: z.number().nullable().optional(),
  kitchen_mean_raw_sec: z.number().nullable().optional(),
  kitchen_mean_ge30_sec: z.number().nullable().optional(),
  cycle_mean_sec: z.number().nullable().optional(),
  order_count_raw: z.number().int().default(0),
  order_count_ge30: z.number().int().default(0),
  order_count_cycle: z.number().int().default(0),
  pct_orders_excluded_ge30: z.number().nullable().optional(),
  pct_orders_with_mckiti: z.number().default(0),
  pct_bumps_dropped_lt30: z.number().nullable().optional(),
});

export type OrderBumpStoreMonth = z.output<typeof orderBumpStoreMonthSchema>;

export const orderBumpStoreAnomalySchema = z.object({
  store_id: z.number(),
  order_count: z.number().int(),
  bump_valid_count: z.number().int(),
  bump_lt30_count: z.number().int(),
  bump_ge30_count: z.number().int(),
  anomaly_pct: z.number(),
  bump_mean_raw_sec: z.number().nullable().optional(),
  bump_mean_ge30_sec: z.number().nullable().optional(),
  order_tts_mean_sec: z.number(),
  order_tts_mean_after_sec: z.number(),
  order_tts_delta_sec: z.number(),
  alert_high: z.boolean().default(false),
});

export type OrderBumpStoreAnomaly = z.output<typeof orderBumpStoreAnomalySchema>;

export const orderBumpKvsStatsSchema = z.object({
  kvs_group: z.number().int(),
  bump_valid_count: z.number().int(),
  bump_lt30_count: z.number().int(),
  bump_ge30_count: z.number().int(),
  anomaly_pct: z.number(),
  bump_mean_raw_sec: z.number().nullable().optional(),
  bump_mean_ge30_sec: z.number().nullable().optional(),
  bump_median_raw_sec: z.number().nullable().optional(),
  lt30_tts_sum_sec: z.number().default(0),
  pct_of_valid_network: z.number().nullable().optional(),
  alert_high: z.boolean().default(false),
});

export type OrderBumpKvsStats = z.output<typeof orderBumpKvsStatsSchema>;

export const orderBumpOrderStatsSchema = z.object({
  store_id: z.number(),
  sale_date: z.string(),
  order_id: z.string(),
  order_key: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  order_tts_sec: z.number(),
  order_tts_after_sec: z.number(),
  bump_tts_sum_lt30_sec: z.number().default(0),
  order_channel: z.string().nullable().optional(),
  order_is_void: z.boolean().optional(),
  bump_count: z.number().int(),
  bump_count_valid: z.number().int(),
  bump_count_ge30: z.number().int(),
  bump_count_lt30: z.number().int(),
  bump_tts_sum_raw_sec: z.number(),
  bump_tts_sum_ge30_sec: z.number(),
  bump_tts_avg_raw_sec: z.number().nullable().optional(),
  bump_tts_avg_ge30_sec: z.number().nullable().optional(),
  bump_tts_max_raw_sec: z.number().nullable().optional(),
  bump_tts_max_ge30_sec: z.number().nullable().optional(),
  pct_bumps_dropped: z.number().nullable().optional(),
  has_full_join: z.boolean().optional(),
  cycle_raw_sec: z.number().nullable().optional(),
});

export type OrderBumpOrderStats = z.output<typeof orderBumpOrderStatsSchema>;

export const orderBumpProcessResponseSchema = z.object({
  echo_config: orderBumpPipelineConfigSchema,
  kpi: orderBumpKpiSchema,
  orders: z.array(orderBumpOrderStatsSchema).default([]),
  store_months: z.array(orderBumpStoreMonthSchema).default([]),
  store_anomaly: z.array(orderBumpStoreAnomalySchema).default([]),
  kvs_stats: z.array(orderBumpKvsStatsSchema).default([]),
  meta: z.record(z.unknown()).default({}),
});

export type OrderBumpProcessResponse = z.output<typeof orderBumpProcessResponseSchema>;

export const orderBumpSamplePresetMetaSchema = z.object({
  preset: z.string(),
  row_count: z.number().int(),
  order_count: z.number().int(),
  store_count: z.number().int(),
  month_count: z.number().int(),
  valid_bump_count: z.number().int(),
  short_bump_count: z.number().int(),
  short_bump_share: z.number(),
  description: z.string(),
});

export const orderBumpSampleResponseSchema = z.object({
  preset: z.string(),
  rows: z.array(orderBumpRowSchema),
  meta: orderBumpSamplePresetMetaSchema,
});

export type OrderBumpSampleResponse = z.infer<typeof orderBumpSampleResponseSchema>;

export function periodLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatSec(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
}

/** Chart-ready store×month point for Order × Bump Network impact. */
export interface OrderBumpImpactPoint {
  store_id: number;
  year: number;
  month: number;
  period_label: string;
  actual_mean_tts_sec: number | null;
  after_ge30_mean_tts_sec: number | null;
  order_tts_mean_sec: number | null;
  order_tts_mean_after_sec: number | null;
  cycle_mean_sec: number | null;
  volume_before: number | null;
  volume_after: number | null;
  volume_cycle: number | null;
}

export function storeMonthsToImpactSeries(
  months: OrderBumpStoreMonth[],
): OrderBumpImpactPoint[] {
  return months.map((row) => ({
    store_id: row.store_id,
    year: row.year,
    month: row.month,
    period_label: periodLabel(row.year, row.month),
    actual_mean_tts_sec: row.kitchen_mean_raw_sec ?? null,
    after_ge30_mean_tts_sec: row.kitchen_mean_ge30_sec ?? null,
    order_tts_mean_sec: row.order_tts_mean_sec,
    order_tts_mean_after_sec: null,
    cycle_mean_sec: row.cycle_mean_sec ?? null,
    volume_before: row.order_count_raw,
    volume_after: row.order_count_ge30,
    volume_cycle: row.order_count_cycle,
  }));
}

export type OrderBumpStepName = 'actual' | 'ge30';

export interface OrderBumpStepMetric {
  step_name: OrderBumpStepName;
  rows_in: number;
  rows_out: number;
  rows_dropped: number;
  mean_tts_sec: number;
  median_tts_sec: number | null;
}

export function buildOrderBumpSteps(
  result: OrderBumpProcessResponse,
): OrderBumpStepMetric[] {
  const valid = result.kpi.bump_valid_count;
  const ge30 = result.kpi.bump_ge30_count;
  const dropped = result.kpi.bump_lt30_count;
  return [
    {
      step_name: 'actual',
      rows_in: valid,
      rows_out: valid,
      rows_dropped: 0,
      mean_tts_sec: result.kpi.bump_mean_raw_sec ?? 0,
      median_tts_sec: null,
    },
    {
      step_name: 'ge30',
      rows_in: valid,
      rows_out: ge30,
      rows_dropped: dropped,
      mean_tts_sec: result.kpi.bump_mean_ge30_sec ?? 0,
      median_tts_sec: null,
    },
  ];
}

export const ORDER_BUMP_STEP_LABELS: Record<OrderBumpStepName, string> = {
  actual: 'Bump TTS (actual)',
  ge30: 'Bump TTS (after ge30)',
};
