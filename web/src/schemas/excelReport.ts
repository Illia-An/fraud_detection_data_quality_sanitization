/** Request body for POST /api/v1/reports/excel. Scores are copied, not recomputed. */

import { z } from 'zod';

import type { PipelineConfig } from './api';
import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import type { TtsKpiPanel } from './ttsKpiPanel';
import type { TtsPlan } from './ttsPlan';

const scoreMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  score: z.number(),
});

export const excelReportRequestSchema = z.object({
  method: z.string().min(1).max(200),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  target: z.number(),
  current_chain: z.number(),
  final_chain: z.number(),
  feasible: z.boolean(),
  sanitization_rows: z
    .array(
      z.object({
        store_id: z.number().int(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
        score: z.number(),
      }),
    )
    .min(1),
  chain_months: z.array(scoreMonthSchema).min(1),
  store_plans: z
    .array(
      z.object({
        store_id: z.number().int(),
        months: z.array(scoreMonthSchema).min(1),
      }),
    )
    .min(1),
});

export type ExcelReportRequest = z.output<typeof excelReportRequestSchema>;

/** Enabled tier names, in pipeline order. The report module does not interpret them. */
export function sanitizationMethodLabel(config: PipelineConfig): string {
  const enabled: string[] = [];
  if (config.tier1_blacklist_enabled) {
    enabled.push('tier1');
  }
  if (config.tier2_freq_enabled) {
    enabled.push('tier2');
  }
  if (config.tier3_always_five_enabled) {
    enabled.push('tier3');
  }
  if (config.tier4_enabled) {
    enabled.push('tier4');
  }
  return enabled.length > 0 ? enabled.join('+') : 'none';
}

export function buildExcelReportRequest(
  panel: SanitizedPanel,
  plan: FivePercentPlan,
): ExcelReportRequest {
  return excelReportRequestSchema.parse({
    method: sanitizationMethodLabel(panel.echo_config),
    period_start: panel.period_start,
    period_end: panel.period_end,
    target: plan.target,
    current_chain: plan.current_chain,
    final_chain: plan.final_chain,
    feasible: plan.feasible,
    sanitization_rows: panel.rows.map((row) => ({
      store_id: row.store_id,
      year: row.year,
      month: row.month,
      score: row.five_percent,
    })),
    chain_months: plan.chain_trajectory,
    store_plans: plan.projections,
  });
}

/** Source label for the TTS baseline panel. Minutes are copied, not recomputed. */
export function ttsBaselineMethodLabel(panel: TtsKpiPanel): string {
  const source = panel.source ?? (panel.preset === 'ap' ? 'ap' : 'synthetic');
  return `tts_kpi:${source}:${panel.preset}`;
}

export function buildTtsExcelReportRequest(
  panel: TtsKpiPanel,
  plan: TtsPlan,
): ExcelReportRequest {
  return excelReportRequestSchema.parse({
    method: ttsBaselineMethodLabel(panel),
    period_start: panel.period_start,
    period_end: panel.period_end,
    target: plan.target,
    current_chain: plan.current_chain,
    final_chain: plan.final_chain,
    feasible: plan.feasible,
    sanitization_rows: panel.rows.map((row) => ({
      store_id: row.store_id,
      year: row.year,
      month: row.month,
      score: row.tts,
    })),
    chain_months: plan.chain_trajectory,
    store_plans: plan.projections,
  });
}
