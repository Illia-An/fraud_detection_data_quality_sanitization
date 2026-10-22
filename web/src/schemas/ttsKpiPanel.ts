/** Monthly TTS KPI panel for the TTS planner. Minutes, not sanitization seconds. */

import { z } from 'zod';

export const ttsKpiPresetSchema = z.enum(['small', 'medium', 'stress']);

export type TtsKpiPreset = z.output<typeof ttsKpiPresetSchema>;

export const ttsKpiPanelRowSchema = z.object({
  store_id: z.number().int(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  tts: z.number(),
});

export type TtsKpiPanelRow = z.output<typeof ttsKpiPanelRowSchema>;

export const ttsKpiPanelSchema = z.object({
  preset: z.enum(['small', 'medium', 'stress', 'ap']),
  source: z.enum(['synthetic', 'ap']).optional(),
  period_start: z.string(),
  period_end: z.string(),
  reference_year: z.number().int(),
  reference_month: z.number().int().min(1).max(12),
  row_count: z.number().int().nonnegative(),
  rows: z.array(ttsKpiPanelRowSchema),
});

export type TtsKpiPanel = z.output<typeof ttsKpiPanelSchema>;
