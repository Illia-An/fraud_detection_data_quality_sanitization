/** Accumulate store implied-target overrides for /simulation/adjust. */

export interface ImpliedAdjustment {
  store_id: number;
  new_implied_target: number;
}

/**
 * Merge one store override into the session list (replace same store_id).
 * Sorted by store_id for stable request payloads / tests.
 */
export function mergeImpliedAdjustment(
  current: ImpliedAdjustment[],
  next: ImpliedAdjustment,
): ImpliedAdjustment[] {
  const byId = new Map(current.map((a) => [a.store_id, a.new_implied_target]));
  byId.set(next.store_id, next.new_implied_target);
  return [...byId.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([store_id, new_implied_target]) => ({ store_id, new_implied_target }));
}
