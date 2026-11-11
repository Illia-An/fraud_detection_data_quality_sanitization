/** Request body for POST /api/v1/reports/excel. Scores are copied, not recomputed. */

import { z } from 'zod';

import { buildStoreCumulativeSlopeLayers } from '../components/planner/cumulativeSlopeLayers';
import type { PipelineConfig } from './api';
import type { SimulationResponse } from './cumulativePlan';
import type { FivePercentPlan } from './plan';
import type { SanitizedPanel } from './sanitizedPanel';
import type { TtsKpiPanel } from './ttsKpiPanel';
import type { TtsPlan } from './ttsPlan';

const scoreMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  score: z.number(),
});

const monthSlot12Schema = z.array(z.number().nullable()).length(12);

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
  store_matrices: z
    .array(
      z.object({
        store_id: z.number().int(),
        monthly_target: monthSlot12Schema,
        cumulative_planned: monthSlot12Schema,
        actual: monthSlot12Schema,
        cumulative_actual_or_simulation: monthSlot12Schema,
        /** Required monthly (data start → target), planning-year M1–12. */
        required_monthly: monthSlot12Schema,
        /** Required cumulative (data start → target), planning-year M1–12. */
        required_cumulative: monthSlot12Schema,
      }),
    )
    .default([]),
  plan_version: z
    .object({
      version_id: z.string().nullable().optional(),
      created_at: z.string().nullable().optional(),
      label: z.string().nullable().optional(),
      network_target: z.number().nullable().optional(),
      as_of_year: z.number().int().nullable().optional(),
      as_of_month: z.number().int().min(1).max(12).nullable().optional(),
      planning_year: z.number().int().nullable().optional(),
      network_mean_at_save: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
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

function slots12(
  planningYear: number,
  rows: { year: number; month: number; score: number }[],
): (number | null)[] {
  const byMonth = new Map(
    rows.filter((r) => r.year === planningYear).map((r) => [r.month, r.score]),
  );
  return Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1) ?? null);
}

function emptySlots12(): (number | null)[] {
  return Array.from({ length: 12 }, () => null);
}

/** Pull planning-year months 1–12 from a full spine series (chart parity). */
export function planningYearSlots12(
  labels: string[],
  values: (number | null)[],
  planningYear: number,
): (number | null)[] {
  const out = emptySlots12();
  const prefix = `${planningYear}-`;
  for (let i = 0; i < labels.length; i += 1) {
    const lab = labels[i];
    if (lab == null || !lab.startsWith(prefix)) {
      continue;
    }
    const month = Number(lab.slice(5));
    if (month >= 1 && month <= 12) {
      out[month - 1] = values[i] ?? null;
    }
  }
  return out;
}

/** Required pair for one store — same grammar as Slope Inspect layers. */
function requiredSlots12ForStore(
  simulation: SimulationResponse,
  storeId: number,
): { required_monthly: (number | null)[]; required_cumulative: (number | null)[] } {
  const layers = buildStoreCumulativeSlopeLayers(simulation, storeId);
  if (!layers) {
    return { required_monthly: emptySlots12(), required_cumulative: emptySlots12() };
  }
  return {
    required_monthly: planningYearSlots12(
      layers.labels,
      layers.requiredMonthlyYs,
      simulation.planning_year,
    ),
    required_cumulative: planningYearSlots12(
      layers.labels,
      layers.requiredCumulativeYs,
      simulation.planning_year,
    ),
  };
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

/**
 * SPEC-P001 D-09 export: thin Plan sheet from draft + StoreMatrix from live simulation.
 * Optional planVersionMeta fills Summary version context after Save Plan.
 */
export function buildExcelReportRequestFromSimulation(
  panel: SanitizedPanel,
  plan: FivePercentPlan,
  simulation: SimulationResponse,
  planVersionMeta?: {
    version_id: string;
    created_at?: string | null;
    label?: string | null;
    network_target?: number | null;
    as_of_year?: number | null;
    as_of_month?: number | null;
    planning_year?: number | null;
    network_mean_at_save?: number | null;
  } | null,
): ExcelReportRequest {
  const planningYear = simulation.planning_year;
  const store_matrices = simulation.stores.map((store) => {
    const required = requiredSlots12ForStore(simulation, store.store_id);
    return {
      store_id: store.store_id,
      monthly_target: slots12(planningYear, store.monthly_target),
      cumulative_planned: slots12(planningYear, store.cumulative_planned),
      actual: slots12(planningYear, store.actual),
      cumulative_actual_or_simulation: slots12(
        planningYear,
        store.cumulative_actual_or_simulation,
      ),
      required_monthly: required.required_monthly,
      required_cumulative: required.required_cumulative,
    };
  });

  return excelReportRequestSchema.parse({
    method: sanitizationMethodLabel(panel.echo_config),
    period_start: panel.period_start,
    period_end: panel.period_end,
    target: simulation.network.network_target,
    current_chain: simulation.network.network_mean_as_of,
    final_chain: simulation.network.projected_network_mean_eoy,
    feasible: simulation.network.feasible,
    sanitization_rows: panel.rows.map((row) => ({
      store_id: row.store_id,
      year: row.year,
      month: row.month,
      score: row.five_percent,
    })),
    chain_months: plan.chain_trajectory,
    store_plans: plan.projections,
    store_matrices,
    plan_version: planVersionMeta
      ? {
          version_id: planVersionMeta.version_id,
          created_at: planVersionMeta.created_at ?? null,
          label: planVersionMeta.label ?? null,
          network_target: planVersionMeta.network_target ?? null,
          as_of_year: planVersionMeta.as_of_year ?? null,
          as_of_month: planVersionMeta.as_of_month ?? null,
          planning_year: planVersionMeta.planning_year ?? planningYear,
          network_mean_at_save: planVersionMeta.network_mean_at_save ?? null,
        }
      : simulation.active_plan_version_id
        ? {
            version_id: simulation.active_plan_version_id,
            planning_year: planningYear,
            as_of_year: simulation.as_of.year,
            as_of_month: simulation.as_of.month,
            network_target: simulation.network.network_target,
          }
        : null,
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
