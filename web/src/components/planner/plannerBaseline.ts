import { periodLabel } from '../../schemas/plan';

export type PeriodRef = { year: number; month: number };

/** Unique year/month pairs from panel rows, sorted ascending. */
export function availablePeriodReferences(
  rows: Iterable<PeriodRef>,
): PeriodRef[] {
  const keys = new Set<string>();
  const out: PeriodRef[] = [];
  for (const row of rows) {
    const key = periodLabel(row.year, row.month);
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    out.push({ year: row.year, month: row.month });
  }
  out.sort((a, b) => a.year - b.year || a.month - b.month);
  return out;
}

/** Rows at the reference month, mapped to the caller’s baseline shape. */
export function baselineRowsAtReference<TRow extends PeriodRef, TOut>(
  rows: readonly TRow[],
  year: number,
  month: number,
  mapRow: (row: TRow) => TOut,
): TOut[] {
  return rows.filter((row) => row.year === year && row.month === month).map(mapRow);
}

/**
 * Equal-weight mean of numeric values (product lock for chain at reference:
 * not volume-weighted).
 */
export function equalWeightMean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function equalWeightMeanBy<T>(
  rows: readonly T[],
  valueOf: (row: T) => number,
): number | null {
  return equalWeightMean(rows.map(valueOf));
}
