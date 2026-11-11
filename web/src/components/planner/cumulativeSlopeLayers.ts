/** Build Plotly-ready Plan / Actual / Simulation series from SimulationResponse. */

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import { requiredPairFromWindowThroughLastFact } from './heroEvaluationSeries';

export interface YearMonth {
  year: number;
  month: number;
}

/**
 * Visual fact/forecast boundary from plotted actuals (may differ from declared as_of
 * when the as-of month has no store fact yet).
 */
export interface SlopeCutover {
  /** Last month with a non-null actual on the chart. */
  factEndLabel: string | null;
  /** First month after fact end — plan/forecast starts here. */
  forecastStartLabel: string | null;
  /** Index of factEndLabel in labels (−1 if none). */
  factEndIndex: number;
  /** Declared simulation as_of label. */
  declaredAsOfLabel: string;
  /** Category where the vertical cutover line is drawn (forecast start when possible). */
  lineLabel: string;
}

/** Shared plot series for network Hero and store Inspect Slope panels. */
export interface CumulativeSlopePlotLayers {
  labels: string[];
  /** Frozen / computed monthly targets. */
  planYs: (number | null)[];
  /** Cumulative planned — planning-year running mean. */
  planCumYs: (number | null)[];
  /** Actual monthly (null after as-of). */
  actualYs: (number | null)[];
  /** Simulation monthly after as-of. */
  simYs: (number | null)[];
  /** Continuous cumulative actual∥sim from data start (context). */
  cumActualSimYs: (number | null)[];
  /**
   * Planning-year YTD cumulative of stitched actual∥sim — fair compare vs planCumYs.
   * Null before planning_year-01.
   */
  cumActualSimYtdYs: (number | null)[];
  /**
   * Required monthlies after last fact so the data-start running mean hits target
   * by planning-year Dec (Legacy required pair, window = spineStart not −3 mo).
   */
  requiredMonthlyYs: (number | null)[];
  /** Running mean from spineStart through last fact, then required monthlies. */
  requiredCumulativeYs: (number | null)[];
  target: number;
  asOfLabel: string;
  cutover: SlopeCutover;
  /** First label month (often cumulative_start, e.g. 2025-01). */
  spineStart: YearMonth;
}

/** Value at a category label, or null. */
export function seriesValueAtLabel(
  labels: string[],
  values: (number | null)[],
  label: string | null,
): number | null {
  if (label == null) {
    return null;
  }
  const idx = labels.indexOf(label);
  if (idx < 0) {
    return null;
  }
  const v = values[idx];
  return v != null && Number.isFinite(v) ? v : null;
}

/** Last finite value in a series (EOY helper). */
export function lastSeriesValue(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      return v;
    }
  }
  return null;
}

export interface InspectSlopeAlign {
  factMonth: string | null;
  fact: number | null;
  planAtFact: number | null;
  /** Last monthly plan level (Dec of planning year). */
  planEndMonthly: number | null;
  /** Last planning-year cumulative plan. */
  eoyPlanCumulative: number | null;
  /** Last planning-year cumulative fact+forecast. */
  eoyForecastCumulative: number | null;
  declaredAsOfLabel: string;
}

/**
 * Canonical Inspect alignment from store Slope layers:
 * fact month = last plotted actual; ends from plan monthly + YTD forecast.
 */
export function buildInspectSlopeAlign(layers: CumulativeSlopePlotLayers): InspectSlopeAlign {
  const factMonth = layers.cutover.factEndLabel;
  const fact = seriesValueAtLabel(layers.labels, layers.actualYs, factMonth);
  const planAtFact = seriesValueAtLabel(layers.labels, layers.planYs, factMonth);
  return {
    factMonth,
    fact,
    planAtFact,
    planEndMonthly: lastSeriesValue(layers.planYs),
    eoyPlanCumulative: lastSeriesValue(layers.planCumYs),
    eoyForecastCumulative: lastSeriesValue(layers.cumActualSimYtdYs),
    declaredAsOfLabel: layers.cutover.declaredAsOfLabel,
  };
}

/** Derive UI cutover from plotted actuals; line sits at first post-fact month when possible. */
export function resolveSlopeCutover(
  labels: string[],
  actualYs: (number | null)[],
  declaredAsOfLabel: string,
): SlopeCutover {
  let factEndIndex = -1;
  for (let i = 0; i < actualYs.length; i += 1) {
    if (actualYs[i] != null) {
      factEndIndex = i;
    }
  }
  if (factEndIndex < 0) {
    const declaredIdx = labels.indexOf(declaredAsOfLabel);
    const lineLabel =
      declaredIdx >= 0
        ? labels[declaredIdx]
        : (labels[0] ?? declaredAsOfLabel);
    return {
      factEndLabel: null,
      forecastStartLabel: lineLabel,
      factEndIndex: -1,
      declaredAsOfLabel,
      lineLabel,
    };
  }
  const factEndLabel = labels[factEndIndex];
  const forecastStartLabel =
    factEndIndex + 1 < labels.length ? labels[factEndIndex + 1] : null;
  return {
    factEndLabel,
    forecastStartLabel,
    factEndIndex,
    declaredAsOfLabel,
    lineLabel: forecastStartLabel ?? factEndLabel,
  };
}

export interface CumulativeSlopeNetworkLayers extends CumulativeSlopePlotLayers {
  planningYear: number;
}

function ymLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function compareYm(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function monthSpan(start: YearMonth, end: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  let year = start.year;
  let month = start.month;
  while (year < end.year || (year === end.year && month <= end.month)) {
    out.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** Earliest month present in store curves; never later than planning_year-01. */
export function inferSlopeSpineStart(sim: SimulationResponse): YearMonth {
  const planStart: YearMonth = { year: sim.planning_year, month: 1 };
  let best: YearMonth = planStart;
  const consider = (year: number, month: number) => {
    const candidate = { year, month };
    if (compareYm(candidate, best) < 0) {
      best = candidate;
    }
  };
  for (const store of sim.stores) {
    for (const series of [
      store.actual,
      store.cumulative_actual,
      store.cumulative_actual_or_simulation,
      store.monthly_target,
      store.cumulative_planned,
      store.simulation,
    ]) {
      for (const row of series) {
        consider(row.year, row.month);
      }
    }
  }
  return best;
}

function meanAt(
  stores: SimulationResponse['stores'],
  pick: (s: SimulationResponse['stores'][number]) => { year: number; month: number; score: number }[],
  year: number,
  month: number,
): number | null {
  const vals: number[] = [];
  for (const store of stores) {
    const hit = pick(store).find((m) => m.year === year && m.month === month);
    if (hit != null) {
      vals.push(hit.score);
    }
  }
  if (vals.length === 0) {
    return null;
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function scoreAt(
  rows: { year: number; month: number; score: number }[],
  year: number,
  month: number,
): number | null {
  const hit = rows.find((m) => m.year === year && m.month === month);
  return hit != null ? hit.score : null;
}

/** Stitched monthly score: actual through as-of, simulation after. */
function storeStitchedMonth(
  store: SimulationResponse['stores'][number],
  ym: YearMonth,
  asOf: YearMonth,
): number | null {
  if (compareYm(ym, asOf) <= 0) {
    return scoreAt(store.actual, ym.year, ym.month);
  }
  return scoreAt(store.simulation, ym.year, ym.month);
}

function networkStitchedMonth(
  stores: SimulationResponse['stores'],
  ym: YearMonth,
  asOf: YearMonth,
): number | null {
  const vals: number[] = [];
  for (const store of stores) {
    const v = storeStitchedMonth(store, ym, asOf);
    if (v != null) {
      vals.push(v);
    }
  }
  if (vals.length === 0) {
    return null;
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Legacy-style required pair with knowledge window from data start (spineStart),
 * not the Hero −3 mo short window. Horizon = Dec of planning year.
 */
export function buildRequiredFromDataStart(
  spine: YearMonth[],
  actualYs: (number | null)[],
  spineStart: YearMonth,
  target: number,
  planningYear: number,
): { requiredMonthlyYs: (number | null)[]; requiredCumulativeYs: (number | null)[] } {
  return requiredPairFromWindowThroughLastFact(
    spine,
    actualYs,
    spineStart,
    target,
    { year: planningYear, month: 12 },
  );
}

/** Running mean of planning-year monthly stitches — same grain as cumulative_planned. */
export function buildPlanningYearCumYs(
  spine: YearMonth[],
  planningYear: number,
  monthlyStitch: (ym: YearMonth) => number | null,
): (number | null)[] {
  let sum = 0;
  let count = 0;
  return spine.map((ym) => {
    if (ym.year !== planningYear) {
      return null;
    }
    const monthly = monthlyStitch(ym);
    if (monthly == null) {
      return count === 0 ? null : sum / count;
    }
    sum += monthly;
    count += 1;
    return sum / count;
  });
}

/** Network-level layers for Hero (equal-weight across stores). */
export function buildNetworkCumulativeSlopeLayers(
  sim: SimulationResponse,
): CumulativeSlopeNetworkLayers {
  const spineStart = inferSlopeSpineStart(sim);
  const spineEnd: YearMonth = { year: sim.planning_year, month: 12 };
  const spine = monthSpan(spineStart, spineEnd);
  const labels = spine.map((ym) => ymLabel(ym.year, ym.month));
  const asOfLabel = ymLabel(sim.as_of.year, sim.as_of.month);
  const asOfIdx = labels.indexOf(asOfLabel);

  const planYs = spine.map((ym) => meanAt(sim.stores, (s) => s.monthly_target, ym.year, ym.month));
  const planCumYs = spine.map((ym) =>
    meanAt(sim.stores, (s) => s.cumulative_planned, ym.year, ym.month),
  );
  const actualYs = spine.map((ym, i) => {
    if (asOfIdx >= 0 && i > asOfIdx) {
      return null;
    }
    return meanAt(sim.stores, (s) => s.actual, ym.year, ym.month);
  });
  const simYs = spine.map((ym, i) => {
    if (asOfIdx >= 0 && i <= asOfIdx) {
      return null;
    }
    return meanAt(sim.stores, (s) => s.simulation, ym.year, ym.month);
  });
  const cumActualSimYs = spine.map((ym) =>
    meanAt(sim.stores, (s) => s.cumulative_actual_or_simulation, ym.year, ym.month),
  );
  const asOfYm: YearMonth = { year: sim.as_of.year, month: sim.as_of.month };
  const cumActualSimYtdYs = buildPlanningYearCumYs(spine, sim.planning_year, (ym) =>
    networkStitchedMonth(sim.stores, ym, asOfYm),
  );
  const cutover = resolveSlopeCutover(labels, actualYs, asOfLabel);
  const required = buildRequiredFromDataStart(
    spine,
    actualYs,
    spineStart,
    sim.network.network_target,
    sim.planning_year,
  );

  return {
    labels,
    planYs,
    planCumYs,
    actualYs,
    simYs,
    cumActualSimYs,
    cumActualSimYtdYs,
    requiredMonthlyYs: required.requiredMonthlyYs,
    requiredCumulativeYs: required.requiredCumulativeYs,
    target: sim.network.network_target,
    asOfLabel,
    cutover,
    planningYear: sim.planning_year,
    spineStart,
  };
}

export interface CumulativeSlopeStoreLayers extends CumulativeSlopePlotLayers {
  unreachable: boolean;
  suggestedImpliedTarget: number | null;
  gapToMean: number;
  slope: number;
}

export interface StoreBoostGlance {
  storeId: number;
  gapToMean: number;
  slope: number;
  unreachable: boolean;
}

export function getStoreBoostGlance(
  sim: SimulationResponse,
  storeId: number,
): StoreBoostGlance | null {
  const store = sim.stores.find((s) => s.store_id === storeId);
  if (!store) {
    return null;
  }
  return {
    storeId,
    gapToMean: store.gap_to_mean,
    slope: store.slope,
    unreachable: store.unreachable,
  };
}

export function buildStoreCumulativeSlopeLayers(
  sim: SimulationResponse,
  storeId: number,
): CumulativeSlopeStoreLayers | null {
  const store = sim.stores.find((s) => s.store_id === storeId);
  if (!store) {
    return null;
  }
  const spineStart = inferSlopeSpineStart(sim);
  const spineEnd: YearMonth = { year: sim.planning_year, month: 12 };
  const spine = monthSpan(spineStart, spineEnd);
  const labels = spine.map((ym) => ymLabel(ym.year, ym.month));
  const asOfLabel = ymLabel(sim.as_of.year, sim.as_of.month);
  const scoreMap = (rows: { year: number; month: number; score: number }[]) => {
    // Keys must match ymLabel (zero-padded month); bare `${year}-${month}` breaks Jan–Sep.
    const m = new Map(rows.map((r) => [ymLabel(r.year, r.month), r.score]));
    return labels.map((lab) => m.get(lab) ?? null);
  };
  const asOfIdx = labels.indexOf(asOfLabel);
  const asOfYm: YearMonth = { year: sim.as_of.year, month: sim.as_of.month };
  const actualRaw = scoreMap(store.actual);
  const simRaw = scoreMap(store.simulation);
  const cumActualSimYtdYs = buildPlanningYearCumYs(spine, sim.planning_year, (ym) =>
    storeStitchedMonth(store, ym, asOfYm),
  );
  const actualYs = actualRaw.map((v, i) => (asOfIdx >= 0 && i > asOfIdx ? null : v));
  const cutover = resolveSlopeCutover(labels, actualYs, asOfLabel);
  const required = buildRequiredFromDataStart(
    spine,
    actualYs,
    spineStart,
    sim.network.network_target,
    sim.planning_year,
  );
  return {
    labels,
    planYs: scoreMap(store.monthly_target),
    planCumYs: scoreMap(store.cumulative_planned),
    actualYs,
    simYs: simRaw.map((v, i) => (asOfIdx >= 0 && i <= asOfIdx ? null : v)),
    cumActualSimYs: scoreMap(store.cumulative_actual_or_simulation),
    cumActualSimYtdYs,
    requiredMonthlyYs: required.requiredMonthlyYs,
    requiredCumulativeYs: required.requiredCumulativeYs,
    target: sim.network.network_target,
    asOfLabel,
    cutover,
    unreachable: store.unreachable,
    suggestedImpliedTarget: store.suggested_implied_target,
    gapToMean: store.gap_to_mean,
    slope: store.slope,
    spineStart,
  };
}
