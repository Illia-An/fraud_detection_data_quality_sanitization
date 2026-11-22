/**
 * Shared planner page shell constants (Wave 8 / M-01).
 * Planner + TTS planner pages share rail geometry and collapsed-play timing.
 */

export const PLANNER_RAIL_WIDTH_PX = 320;
/** Figma collapsed navigation variant (figm_res_v2 §2.2). */
export const PLANNER_RAIL_COLLAPSED_PX = 64;
/** Delay before showing collapsed Play so the collapse click cannot ghost-hit it. */
export const PLANNER_COLLAPSED_PLAY_REVEAL_MS = 250;

/** Collapsed At-risk summary height (Figma overview disclosure ≈ 52 px). */
export const PLANNER_AT_RISK_SUMMARY_RESERVE_PX = 52;
/** Gap above At-risk overlay — chart-to-chart / section rhythm 12 px. */
export const PLANNER_AT_RISK_GAP_PX = 12;
/** Expanded At-risk overlay cap on md (TTS legacy). */
export const PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT = '45vh';
/**
 * Legacy flow dock expanded height (TTS overlay / tests).
 * Network Planner uses two full-viewport screens; panels fill screen 2.
 */
export const PLANNER_AT_RISK_EXPANDED_HEIGHT_PX = 300;
/** @deprecated Panels fill the second viewport screen — kept for older imports/tests. */
export const PLANNER_AT_RISK_PANELS_HEIGHT_PX = 300;

/** Prefer this month when present in the loaded panel (DB demo path). */
export const PLANNER_PREFERRED_REFERENCE = { year: 2025, month: 12 } as const;

export interface PlannerReference {
  year: number;
  month: number;
}

/**
 * Choose the reference month for Plan controls.
 * - no references -> `null` (nothing to select)
 * - current selection still present -> keep it
 * - otherwise the preferred month if present, else the latest reference
 */
export function pickReference(
  refs: readonly PlannerReference[],
  currentYear: number | null,
  currentMonth: number | null,
): PlannerReference | null {
  if (refs.length === 0) {
    return null;
  }
  if (currentYear != null && currentMonth != null) {
    const current = refs.find((ref) => ref.year === currentYear && ref.month === currentMonth);
    if (current) {
      return current;
    }
  }
  const preferred = refs.find(
    (ref) =>
      ref.year === PLANNER_PREFERRED_REFERENCE.year &&
      ref.month === PLANNER_PREFERRED_REFERENCE.month,
  );
  return preferred ?? refs[refs.length - 1];
}
