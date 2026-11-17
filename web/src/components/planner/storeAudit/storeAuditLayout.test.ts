import { describe, expect, it } from 'vitest';

import { SLOPE_PANEL_MIN_HEIGHT_PX } from '../slopeHeroShared';
import {
  INSPECT_DIALOG_PAPER_MAX_PX,
  SANDBOX_OVERLAY_GAP_PX,
  SANDBOX_OVERLAY_MAX_HEIGHT,
  SANDBOX_SUMMARY_RESERVE_PX,
  STORE_HERO_IN_DIALOG_MIN_PX,
  STORE_SLOPE_IN_DIALOG_MIN_PX,
} from './storeAuditLayout';

describe('storeAuditLayout', () => {
  it('exports Inspect dialog size constants', () => {
    expect(INSPECT_DIALOG_PAPER_MAX_PX).toBe(1580);
    expect(SANDBOX_SUMMARY_RESERVE_PX).toBe(56);
    expect(SANDBOX_OVERLAY_GAP_PX).toBe(8);
    expect(SANDBOX_OVERLAY_MAX_HEIGHT).toBe('42vh');
    expect(STORE_HERO_IN_DIALOG_MIN_PX).toBe(280);
    expect(STORE_SLOPE_IN_DIALOG_MIN_PX).toBe(SLOPE_PANEL_MIN_HEIGHT_PX * 2);
  });
});
