/**
 * Survey-data period presets for source=db /process window.
 * Single source of truth resolved in the UI before Run.
 */
import { z } from 'zod';

export const periodPresetSchema = z.enum(['ytd_2026', 'from_2025', 'custom']);
export type PeriodPreset = z.infer<typeof periodPresetSchema>;

export const DEFAULT_PERIOD_PRESET: PeriodPreset = 'from_2025';

export const PERIOD_PRESET_OPTIONS: ReadonlyArray<{
  value: PeriodPreset;
  label: string;
}> = [
  { value: 'ytd_2026', label: '2026 YTD' },
  { value: 'from_2025', label: '2025 – Present' },
  { value: 'custom', label: 'Custom Range' },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDateSchema = z.string().regex(ISO_DATE_RE, 'Expected YYYY-MM-DD');

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function formatLocalIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface PeriodWindow {
  from_date: string;
  to_date: string | null;
}

export function resolvePeriodWindow(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): PeriodWindow {
  switch (preset) {
    case 'ytd_2026':
      return { from_date: '2026-01-01', to_date: formatLocalIsoDate(now) };
    case 'from_2025':
      return { from_date: '2025-01-01', to_date: null };
    case 'custom': {
      const from = ISO_DATE_RE.test(customFrom) ? customFrom : '2025-01-01';
      const to = ISO_DATE_RE.test(customTo) ? customTo : null;
      return { from_date: from, to_date: to };
    }
  }
}

/** Fields to merge into ProcessRequest for source=db. */
export function periodFieldsForProcess(window: PeriodWindow): {
  from_date: string;
  to_date?: string;
} {
  if (window.to_date == null) {
    return { from_date: window.from_date };
  }
  return { from_date: window.from_date, to_date: window.to_date };
}
