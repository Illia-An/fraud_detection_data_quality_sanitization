/**
 * EXP: harvest ahead-of-plan surplus and lift behind stores (session draft only).
 * Does not touch DB / Export semantics beyond mutating the in-memory draft plan.
 */

import type { FivePercentPlan } from './plan';
import { periodLabel } from './plan';
import type { PlanMonitoringInsights, StoreMonitorRow } from './planMonitoring';

export interface SurplusRedistributeParams {
  /** How many ahead stores donate surplus budget. */
  topDonors: number;
  /** How many behind stores receive the pool. */
  topReceivers: number;
  /** Fraction of each donor's surplus (actual − plan) to harvest, 0–1. */
  harvestFraction: number;
  asOfYear: number;
  asOfMonth: number;
  /**
   * If true, lower donor plan scores by their harvest (near zero-sum network).
   * If false, only raise receivers — network equal-mean rises (demo-visible).
   */
  clawbackDonors: boolean;
  floor?: number;
  ceiling?: number;
}

export interface SurplusRedistributeResult {
  plan: FivePercentPlan;
  poolPp: number;
  harvestedPp: number;
  distributedPp: number;
  leftoverPp: number;
  donorIds: number[];
  receiverIds: number[];
  /** final_chain(new) − final_chain(old). */
  networkDeltaPp: number;
  mode: 'spend' | 'clawback';
}

const DEFAULTS = {
  topDonors: 10,
  topReceivers: 10,
  harvestFraction: 0.5,
  clawbackDonors: false,
  floor: 0,
  ceiling: 100,
} as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function periodKey(year: number, month: number): string {
  return periodLabel(year, month);
}

function isOnOrAfterAsOf(
  year: number,
  month: number,
  asOfYear: number,
  asOfMonth: number,
): boolean {
  return periodKey(year, month) >= periodKey(asOfYear, asOfMonth);
}

function applyDeltaFromAsOf(
  plan: FivePercentPlan,
  storeId: number,
  deltaPp: number,
  asOfYear: number,
  asOfMonth: number,
  floor: number,
  ceiling: number,
): number {
  /** Returns how much of |delta| was actually applied on the as-of month (capacity). */
  const projection = plan.projections.find((p) => p.store_id === storeId);
  if (!projection || Math.abs(deltaPp) < 1e-12) {
    return 0;
  }

  let appliedAtAsOf = 0;
  for (const point of projection.months) {
    if (!isOnOrAfterAsOf(point.year, point.month, asOfYear, asOfMonth)) {
      continue;
    }
    const next = Math.min(ceiling, Math.max(floor, point.score + deltaPp));
    const applied = next - point.score;
    if (
      point.year === asOfYear &&
      point.month === asOfMonth
    ) {
      appliedAtAsOf = applied;
    }
    point.score = round2(next);
  }
  return appliedAtAsOf;
}

/** Equal-mean chain from store projections (product lock for Current/network). */
export function recomputeChainFromProjections(plan: FivePercentPlan): FivePercentPlan {
  const storeCount = plan.projections.length;
  if (storeCount === 0 || plan.chain_trajectory.length === 0) {
    return plan;
  }

  const chain_trajectory = plan.chain_trajectory.map((period) => {
    let sum = 0;
    let n = 0;
    for (const projection of plan.projections) {
      const hit = projection.months.find(
        (m) => m.year === period.year && m.month === period.month,
      );
      if (hit) {
        sum += hit.score;
        n += 1;
      }
    }
    return {
      year: period.year,
      month: period.month,
      score: round2(n === 0 ? period.score : sum / n),
    };
  });

  const final_chain = chain_trajectory[chain_trajectory.length - 1]?.score ?? plan.final_chain;
  const required_change = round2(plan.target - plan.current_chain);
  const feasible = final_chain + 1e-9 >= plan.target;

  return {
    ...plan,
    chain_trajectory,
    final_chain,
    required_change,
    feasible,
  };
}

function pickDonors(stores: StoreMonitorRow[], topN: number): StoreMonitorRow[] {
  return stores
    .filter((s) => s.signal === 'ahead_of_plan' && s.deviation != null && s.deviation > 0)
    .sort((a, b) => (b.deviation ?? 0) - (a.deviation ?? 0))
    .slice(0, Math.max(0, topN));
}

function pickReceivers(stores: StoreMonitorRow[], topN: number): StoreMonitorRow[] {
  return stores
    .filter((s) => s.signal === 'behind_plan' && s.deviation != null && s.deviation < 0)
    .sort((a, b) => (a.deviation ?? 0) - (b.deviation ?? 0))
    .slice(0, Math.max(0, topN));
}

/**
 * Deep-clone plan projections, harvest ahead surplus, lift behind from as-of → end.
 */
export function redistributeSurplusToBehind(
  plan: FivePercentPlan,
  insights: PlanMonitoringInsights,
  params: Partial<SurplusRedistributeParams> = {},
): SurplusRedistributeResult {
  const topDonors = params.topDonors ?? DEFAULTS.topDonors;
  const topReceivers = params.topReceivers ?? DEFAULTS.topReceivers;
  const harvestFraction = Math.min(1, Math.max(0, params.harvestFraction ?? DEFAULTS.harvestFraction));
  const clawbackDonors = params.clawbackDonors ?? DEFAULTS.clawbackDonors;
  const floor = params.floor ?? DEFAULTS.floor;
  const ceiling = params.ceiling ?? DEFAULTS.ceiling;
  const asOfYear = params.asOfYear ?? insights.as_of_year;
  const asOfMonth = params.asOfMonth ?? insights.as_of_month;

  const working: FivePercentPlan = structuredClone(plan);
  const donors = pickDonors(insights.stores, topDonors);
  const receivers = pickReceivers(insights.stores, topReceivers);

  const donorHarvest = donors.map((d) => ({
    storeId: d.store_id,
    harvest: round2((d.deviation ?? 0) * harvestFraction),
  }));

  const poolPp = round2(donorHarvest.reduce((sum, d) => sum + d.harvest, 0));
  let harvestedPp = 0;

  if (clawbackDonors) {
    for (const donor of donorHarvest) {
      if (donor.harvest <= 0) {
        continue;
      }
      const applied = applyDeltaFromAsOf(
        working,
        donor.storeId,
        -donor.harvest,
        asOfYear,
        asOfMonth,
        floor,
        ceiling,
      );
      harvestedPp += Math.abs(applied);
    }
    harvestedPp = round2(harvestedPp);
  } else {
    harvestedPp = poolPp;
  }

  const spendPool = clawbackDonors ? harvestedPp : poolPp;
  let distributedPp = 0;
  let leftoverPp = spendPool;

  if (receivers.length > 0 && spendPool > 1e-9) {
    // Capacity-aware multi-pass even split across receivers.
    const remainingByStore = new Map(receivers.map((r) => [r.store_id, 0]));
    let remaining = spendPool;
    for (let pass = 0; pass < 24 && remaining > 1e-9; pass += 1) {
      const eligible = receivers.filter((r) => {
        const projection = working.projections.find((p) => p.store_id === r.store_id);
        const asOfPoint = projection?.months.find(
          (m) => m.year === asOfYear && m.month === asOfMonth,
        );
        return asOfPoint != null && asOfPoint.score < ceiling - 1e-9;
      });
      if (eligible.length === 0) {
        break;
      }
      const share = remaining / eligible.length;
      let placed = 0;
      for (const row of eligible) {
        const applied = applyDeltaFromAsOf(
          working,
          row.store_id,
          share,
          asOfYear,
          asOfMonth,
          floor,
          ceiling,
        );
        remainingByStore.set(
          row.store_id,
          (remainingByStore.get(row.store_id) ?? 0) + applied,
        );
        placed += applied;
      }
      remaining -= placed;
      if (placed < 1e-12) {
        break;
      }
    }
    distributedPp = round2(spendPool - remaining);
    leftoverPp = round2(remaining);
  }

  const next = recomputeChainFromProjections(working);
  const networkDeltaPp = round2(next.final_chain - plan.final_chain);

  return {
    plan: next,
    poolPp,
    harvestedPp,
    distributedPp,
    leftoverPp,
    donorIds: donors.map((d) => d.store_id),
    receiverIds: receivers.map((r) => r.store_id),
    networkDeltaPp,
    mode: clawbackDonors ? 'clawback' : 'spend',
  };
}
