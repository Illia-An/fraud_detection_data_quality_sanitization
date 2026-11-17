/** Signed delta for Inspect chips / pool table (e.g. `+1.20`, `-0.50`). */
export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

/** Fixed-point score display for estimate / actual cells. */
export function formatScore(value: number, digits: number): string {
  return value.toFixed(digits);
}

/**
 * Digits and hard floor/ceiling for sandbox inputs by plan unit
 * (`min` → TTS minutes; otherwise 5% score).
 */
export function scoreDisplayForUnit(unit: string): {
  digits: number;
  floor: number;
  ceiling: number;
} {
  if (unit === 'min') {
    return { digits: 2, floor: 0, ceiling: 30 };
  }
  return { digits: 1, floor: 0, ceiling: 100 };
}
