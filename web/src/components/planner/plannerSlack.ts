/** Network slack / error-budget helpers for the Planner context strip (soft, not statistical). */

export interface NetworkSlack {
  /** Target − projected chain (pp). Positive = still short of goal. */
  remainingPp: number;
  /** Target − current chain (pp). Absolute gap that the plan aims to close. */
  gapPp: number;
  /**
   * Fraction of the gap closed by the projection in [0, 1].
   * 1 = projected at/past target (when improving) or at/below target (when declining).
   */
  progress01: number;
  /** Human-readable status for the slack bar caption. */
  statusLabel: string;
}

/**
 * Datadog-style error-budget progress toward Target from Current via Projected.
 * Pure / deterministic — safe for unit tests.
 */
export function computeNetworkSlack(
  targetPct: number,
  currentChainPct: number,
  projectedChainPct: number,
): NetworkSlack {
  const remainingPp = targetPct - projectedChainPct;
  const gapPp = targetPct - currentChainPct;
  const absGap = Math.abs(gapPp);

  let progress01 = 1;
  if (absGap > 1e-9) {
    const moved = projectedChainPct - currentChainPct;
    progress01 = Math.max(0, Math.min(1, moved / gapPp));
  } else {
    progress01 = Math.abs(remainingPp) < 1e-9 ? 1 : 0;
  }

  let statusLabel: string;
  if (remainingPp > 0.05) {
    statusLabel = `${remainingPp.toFixed(1)} pp slack to target`;
  } else if (remainingPp < -0.05) {
    statusLabel = `${Math.abs(remainingPp).toFixed(1)} pp ahead of target`;
  } else {
    statusLabel = 'At target';
  }

  return { remainingPp, gapPp, progress01, statusLabel };
}
