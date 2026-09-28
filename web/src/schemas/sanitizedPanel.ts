/** Cleansed Q10012 monthly panel for Planner handoff (TASK-14). */

import { z } from 'zod';

import type { PipelineConfig, ProcessResponse, StoreImpactPoint } from './api';
import { pipelineConfigSchema } from './api';

export const sanitizedPanelRowSchema = z.object({
  store_id: z.number().int(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  five_percent: z.number(),
  survey_volume: z.number().int().min(0),
});

export type SanitizedPanelRow = z.output<typeof sanitizedPanelRowSchema>;

export const sanitizedPanelSchema = z.object({
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  echo_config: pipelineConfigSchema,
  reference_year: z.number().int().nullable(),
  reference_month: z.number().int().min(1).max(12).nullable(),
  row_count: z.number().int().nonnegative(),
  rows: z.array(sanitizedPanelRowSchema),
});

export type SanitizedPanel = z.output<typeof sanitizedPanelSchema>;

/** Prefer final tier pct; fall back through earlier tiers when a step was skipped. */
export function cleanFivePercent(point: StoreImpactPoint): number | null {
  const candidates = [
    point.after_tier4_five_pct,
    point.after_tier3_five_pct,
    point.after_tier2_five_pct,
    point.after_tier1_five_pct,
  ];
  for (const value of candidates) {
    if (value != null && !Number.isNaN(value)) {
      return value;
    }
  }
  return null;
}

function metaPeriodString(meta: ProcessResponse['meta'], key: string): string | null {
  const value = meta[key];
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function suggestReference(rows: SanitizedPanelRow[]): {
  reference_year: number | null;
  reference_month: number | null;
} {
  if (rows.length === 0) {
    return { reference_year: null, reference_month: null };
  }
  let best = rows[0];
  for (const row of rows) {
    if (row.year > best.year || (row.year === best.year && row.month > best.month)) {
      best = row;
    }
  }
  return { reference_year: best.year, reference_month: best.month };
}

/**
 * Build planner baseline panel from a successful /process response.
 * Rows without a cleansed five_percent are omitted.
 */
export function buildSanitizedPanelFromProcess(
  result: ProcessResponse,
): SanitizedPanel {
  const rows: SanitizedPanelRow[] = [];
  for (const point of result.store_impact_series) {
    const fivePercent = cleanFivePercent(point);
    if (fivePercent == null) {
      continue;
    }
    rows.push({
      store_id: point.store_id,
      year: point.year,
      month: point.month,
      five_percent: fivePercent,
      survey_volume: point.final_volume,
    });
  }
  rows.sort(
    (a, b) =>
      a.store_id - b.store_id || a.year - b.year || a.month - b.month,
  );
  const { reference_year, reference_month } = suggestReference(rows);
  const panel: SanitizedPanel = {
    period_start: metaPeriodString(result.meta, 'period_start'),
    period_end: metaPeriodString(result.meta, 'period_end'),
    echo_config: result.echo_config as PipelineConfig,
    reference_year,
    reference_month,
    row_count: rows.length,
    rows,
  };
  return sanitizedPanelSchema.parse(panel);
}

/** CSV body (Excel-openable) for experiment export — no new deps. */
export function sanitizedPanelToCsv(panel: SanitizedPanel): string {
  const header = 'store_id,year,month,five_percent,survey_volume';
  const lines = panel.rows.map(
    (row) =>
      `${row.store_id},${row.year},${row.month},${row.five_percent},${row.survey_volume}`,
  );
  return [header, ...lines].join('\n');
}

export function downloadSanitizedPanelCsv(panel: SanitizedPanel, filename?: string): void {
  const blob = new Blob([sanitizedPanelToCsv(panel)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    filename ??
    `sanitized_panel_q10012_${panel.reference_year ?? 'na'}-${String(panel.reference_month ?? 0).padStart(2, '0')}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
