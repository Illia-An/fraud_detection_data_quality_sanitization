/** Presentation helpers for Slope chart axis chrome (ticks + year bands). */

import type { PlotlyAnnotation } from './slopeHeroShared';

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Parse `YYYY-MM` category labels used by Slope layers. */
export function parseYmLabel(label: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m) {
    return null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

/**
 * Compact tick text: `Jan '25`, then `Feb`… until the year changes → `Jan '26`.
 * Non YYYY-MM labels pass through unchanged.
 */
export function formatSlopeTickLabels(labels: string[]): string[] {
  let prevYear: number | null = null;
  return labels.map((label) => {
    const parsed = parseYmLabel(label);
    if (!parsed) {
      return label;
    }
    const abbr = MONTH_ABBR[parsed.month - 1];
    const showYear = prevYear == null || parsed.year !== prevYear;
    prevYear = parsed.year;
    if (showYear) {
      const yy = String(parsed.year).slice(-2);
      return `${abbr} '${yy}`;
    }
    return abbr;
  });
}

/**
 * Bottom band captions under the plot: `{year} history` before planning year,
 * `{year} planning year` for the planning year span.
 */
export function buildYearBandAnnotations(
  labels: string[],
  planningYear: number,
  copy: { history: (year: number) => string; planning: (year: number) => string },
): PlotlyAnnotation[] {
  if (labels.length === 0) {
    return [];
  }
  const years = new Map<number, { start: number; end: number }>();
  for (let i = 0; i < labels.length; i += 1) {
    const parsed = parseYmLabel(labels[i]);
    if (!parsed) {
      continue;
    }
    const span = years.get(parsed.year);
    if (!span) {
      years.set(parsed.year, { start: i, end: i });
    } else {
      span.end = i;
    }
  }
  const ordered = [...years.entries()].sort((a, b) => a[0] - b[0]);
  if (ordered.length === 0) {
    return [];
  }
  return ordered.map(([year, span]) => {
    const mid = Math.floor((span.start + span.end) / 2);
    const text =
      year === planningYear ? copy.planning(year) : copy.history(year);
    return {
      x: labels[mid],
      y: 0,
      xref: 'x' as const,
      yref: 'paper' as const,
      text,
      showarrow: false,
      xanchor: 'center' as const,
      yanchor: 'top' as const,
      yshift: -18,
      font: { size: 10, color: '#757575' },
    };
  });
}

/** Planning year = max year present on the spine (Dec of that year is the horizon). */
export function inferPlanningYear(labels: string[]): number | null {
  let max: number | null = null;
  for (const label of labels) {
    const parsed = parseYmLabel(label);
    if (!parsed) {
      continue;
    }
    if (max == null || parsed.year > max) {
      max = parsed.year;
    }
  }
  return max;
}
