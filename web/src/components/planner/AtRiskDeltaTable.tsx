/**
 * Compatibility wrapper — tests and legacy imports.
 * Prefer mounting AtRiskExceptionPanel + AtRiskPathPanel via AtRiskPanelsSection.
 */
export type { StoreBaselineRow } from './atRiskRowMetrics';
export type { AtRiskFilter } from './atRiskRows';
export { TOP_SLICE_LIMIT } from './atRiskRows';

export { AtRiskPanelsSection as AtRiskDeltaTable } from './AtRiskPanelsSection';
