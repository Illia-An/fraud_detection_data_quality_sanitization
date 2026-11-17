import { SLOPE_PANEL_MIN_HEIGHT_PX } from '../slopeHeroShared';

/** EXP: large Inspect dialog — room for store Hero + sandbox (~+13% vs 1400). */
export const INSPECT_DIALOG_PAPER_MAX_PX = 1580;
/** Collapsed Estimate funnel strip reserved so Hero is not covered. */
export const SANDBOX_SUMMARY_RESERVE_PX = 56;
export const SANDBOX_OVERLAY_GAP_PX = 8;
/** Expanded Estimate overlay cap — chart underneath keeps space. */
export const SANDBOX_OVERLAY_MAX_HEIGHT = '42vh';
/** Min plot height when legacy chart fills remaining Inspect pane. */
export const STORE_HERO_IN_DIALOG_MIN_PX = 280;
/** Dual Slope panels need roughly 2× panel min inside the dialog. */
export const STORE_SLOPE_IN_DIALOG_MIN_PX = SLOPE_PANEL_MIN_HEIGHT_PX * 2;
