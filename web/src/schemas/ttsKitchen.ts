/**
 * Zod mirror of GET /api/v1/tts-kitchen/before-after.
 * Means are seconds. pct_dropped is a share from 0 to 1.
 */
import { z } from 'zod';

export const KITCHEN_PERIOD_START = '2026-09-01';
export const KITCHEN_PERIOD_END = '2026-10-20';

export const kitchenMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  mean_before_sec: z.number().nullable(),
  mean_after_sec: z.number().nullable(),
});

export type KitchenMonth = z.infer<typeof kitchenMonthSchema>;

export const kitchenLevelSchema = z.object({
  rows_in: z.number().int(),
  rows_dropped: z.number().int(),
  pct_dropped: z.number().nullable(),
  mean_before_sec: z.number().nullable(),
  mean_after_sec: z.number().nullable(),
  delta_sec: z.number().nullable(),
});

export type KitchenLevel = z.infer<typeof kitchenLevelSchema>;

export const kitchenStoreSchema = kitchenLevelSchema.extend({
  store_id: z.number(),
  months: z.array(kitchenMonthSchema),
});

export type KitchenStore = z.infer<typeof kitchenStoreSchema>;

export const kitchenMeitSchema = kitchenLevelSchema.extend({
  meit_number: z.number().int(),
});

export type KitchenMeit = z.infer<typeof kitchenMeitSchema>;

export const kitchenBeforeAfterSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  tts_min_sec: z.number().int().min(0),
  network: kitchenLevelSchema,
  network_months: z.array(kitchenMonthSchema),
  by_store: z.array(kitchenStoreSchema),
  by_meit: z.array(kitchenMeitSchema),
});

export type KitchenBeforeAfter = z.infer<typeof kitchenBeforeAfterSchema>;

export function sortKitchenMeitByDropped(rows: KitchenMeit[]): KitchenMeit[] {
  return [...rows].sort(
    (a, b) => b.rows_dropped - a.rows_dropped || a.meit_number - b.meit_number,
  );
}
