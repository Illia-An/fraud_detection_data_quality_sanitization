/** Cleansed TTS monthly panel for planner-like handoff (Stage 5). */

import { z } from 'zod';

import {
  ttsPipelineConfigSchema,
  type TtsPipelineConfig,
  type TtsSanitizationResponse,
  type TtsStoreImpactPoint,
} from './tts';

export const ttsSanitizedPanelRowSchema = z.object({
  store_id: z.number().int(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  tts_sec: z.number(),
  volume: z.number().int().min(0),
});

export type TtsSanitizedPanelRow = z.output<typeof ttsSanitizedPanelRowSchema>;

export const ttsSanitizedPanelSchema = z.object({
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  echo_config: ttsPipelineConfigSchema,
  reference_year: z.number().int().nullable(),
  reference_month: z.number().int().min(1).max(12).nullable(),
  row_count: z.number().int().nonnegative(),
  rows: z.array(ttsSanitizedPanelRowSchema),
});

export type TtsSanitizedPanel = z.output<typeof ttsSanitizedPanelSchema>;

/** Cleansed mean TTS after ge30; null when the cell has no post-filter score. */
export function cleanTtsSec(point: TtsStoreImpactPoint): number | null {
  const value = point.after_ge30_mean_tts_sec;
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function metaPeriodString(
  meta: TtsSanitizationResponse['meta'],
  key: string,
): string | null {
  const value = meta[key];
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function suggestReference(rows: TtsSanitizedPanelRow[]): {
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
 * Build planner-gate panel from a successful /process-tts response.
 * Rows without cleansed ``after_ge30_mean_tts_sec`` are omitted.
 */
export function buildTtsSanitizedPanelFromProcess(
  result: TtsSanitizationResponse,
): TtsSanitizedPanel {
  const rows: TtsSanitizedPanelRow[] = [];
  for (const point of result.store_impact_series) {
    const ttsSec = cleanTtsSec(point);
    if (ttsSec == null) {
      continue;
    }
    rows.push({
      store_id: point.store_id,
      year: point.year,
      month: point.month,
      tts_sec: ttsSec,
      volume: point.volume_after ?? 0,
    });
  }
  rows.sort(
    (a, b) => a.store_id - b.store_id || a.year - b.year || a.month - b.month,
  );
  const { reference_year, reference_month } = suggestReference(rows);
  const panel: TtsSanitizedPanel = {
    period_start: metaPeriodString(result.meta, 'period_start'),
    period_end: metaPeriodString(result.meta, 'period_end'),
    echo_config: result.echo_config as TtsPipelineConfig,
    reference_year,
    reference_month,
    row_count: rows.length,
    rows,
  };
  return ttsSanitizedPanelSchema.parse(panel);
}

/** Stage 6 gate: panel exists and has at least one store×month cell. */
export function isTtsPanelReady(panel: TtsSanitizedPanel | null | undefined): boolean {
  return Boolean(panel && panel.row_count > 0);
}

/** CSV body (Excel-openable) — no new deps. */
export function ttsSanitizedPanelToCsv(panel: TtsSanitizedPanel): string {
  const header = 'store_id,year,month,tts_sec,volume';
  const lines = panel.rows.map(
    (row) => `${row.store_id},${row.year},${row.month},${row.tts_sec},${row.volume}`,
  );
  return [header, ...lines].join('\n');
}

export function downloadTtsSanitizedPanelCsv(
  panel: TtsSanitizedPanel,
  filename?: string,
): void {
  const blob = new Blob([ttsSanitizedPanelToCsv(panel)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    filename ??
    `sanitized_panel_tts_${panel.reference_year ?? 'na'}-${String(panel.reference_month ?? 0).padStart(2, '0')}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
