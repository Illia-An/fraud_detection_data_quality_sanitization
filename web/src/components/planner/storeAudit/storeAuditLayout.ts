import { NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX } from '../slopeHeroShared';

/** Figma inspection dialog width cap (figm_res_v2 §4.1 / §8). */
export const INSPECT_DIALOG_PAPER_MAX_PX = 1600;
/** Collapsed Estimate funnel strip reserved so Hero is not covered. */
export const SANDBOX_SUMMARY_RESERVE_PX = 56;
export const SANDBOX_OVERLAY_GAP_PX = 8;
/** Expanded Estimate overlay cap — chart underneath keeps space. */
export const SANDBOX_OVERLAY_MAX_HEIGHT = '42vh';
/** Min plot height when legacy chart fills remaining Inspect pane. */
export const STORE_HERO_IN_DIALOG_MIN_PX = 280;
/** Figma §4.2: Inspect shows one compact cumulative card only. */
export const STORE_SLOPE_IN_DIALOG_MIN_PX = NETWORK_SLOPE_CARD_HEIGHT_COMPACT_PX;
