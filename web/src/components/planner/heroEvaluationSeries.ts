/** Build Evaluation-View series for the Planner hero (fact | as-of | forecast). */

import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

export interface HeroEvaluationSeries {
  labels: string[];
  factYs: (number | null)[];
  draftYs: (number | null)[];
  approvedYs: (number | null)[];
  upperYs: (number | null)[];
  lowerYs: (number | null)[];
  target: number;
  asOfLabel: string;
}

interface PeriodPoint {
  year: number;
  month: number;
}

function periodCmp(a: PeriodPoint, b: PeriodPoint): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function atOrBefore(a: PeriodPoint, b: PeriodPoint): boolean {
  return periodCmp(a, b) <= 0;
}

function atOrAfter(a: PeriodPoint, b: PeriodPoint): boolean {
  return periodCmp(a, b) >= 0;
}

function networkActual(
  panel: SanitizedPanel,
  year: number,
  month: number,
  storeIds: number[],
): number | null {
  const ids = storeIds.length > 0 ? storeIds : [...new Set(panel.rows.map((r) => r.store_id))];
  const scores: number[] = [];
  for (const storeId of ids) {
    const row = panel.rows.find(
      (r) => r.store_id === storeId && r.year === year && r.month === month,
    );
    if (row) {
      scores.push(row.five_percent);
    }
  }
  if (scores.length === 0) {
    return null;
  }
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Timeline = cleansed panel months ≤ as-of ∪ plan trajectory months.
 * Fact solid left of / on as-of; draft/approved/cone from as-of onward (soft slack, not CI).
 */
export function buildHeroEvaluationSeries(
  draftPlan: FivePercentPlan,
  approvedPlan: FivePercentPlan | null,
  panel: SanitizedPanel,
  asOf: { year: number; month: number },
  slackBandPp: number,
): HeroEvaluationSeries {
  const storeIds = draftPlan.projections.map((p) => p.store_id);
  const asOfLabel = periodLabel(asOf.year, asOf.month);
  const periodMap = new Map<string, PeriodPoint>();

  for (const row of panel.rows) {
    if (storeIds.length > 0 && !storeIds.includes(row.store_id)) {
      continue;
    }
    const point = { year: row.year, month: row.month };
    if (atOrBefore(point, asOf)) {
      periodMap.set(periodLabel(point.year, point.month), point);
    }
  }
  for (const point of draftPlan.chain_trajectory) {
    periodMap.set(periodLabel(point.year, point.month), {
      year: point.year,
      month: point.month,
    });
  }
  periodMap.set(asOfLabel, { year: asOf.year, month: asOf.month });

  const periods = [...periodMap.values()].sort(periodCmp);
  const labels = periods.map((p) => periodLabel(p.year, p.month));

  const draftByLabel = new Map(
    draftPlan.chain_trajectory.map((p) => [periodLabel(p.year, p.month), p.score]),
  );
  const approvedByLabel = new Map(
    (approvedPlan?.chain_trajectory ?? []).map((p) => [
      periodLabel(p.year, p.month),
      p.score,
    ]),
  );

  const factYs = periods.map((p) => {
    if (!atOrBefore(p, asOf)) {
      return null;
    }
    return networkActual(panel, p.year, p.month, storeIds);
  });

  const draftYs = periods.map((p) => {
    if (!atOrAfter(p, asOf)) {
      return null;
    }
    const key = periodLabel(p.year, p.month);
    if (draftByLabel.has(key)) {
      return draftByLabel.get(key)!;
    }
    // Bridge as-of when it sits before the first trajectory month.
    if (key === asOfLabel) {
      return draftPlan.current_chain;
    }
    return null;
  });

  const approvedYs = periods.map((p) => {
    if (!atOrAfter(p, asOf)) {
      return null;
    }
    const key = periodLabel(p.year, p.month);
    if (approvedPlan) {
      return approvedByLabel.get(key) ?? null;
    }
    if (draftByLabel.has(key) || key === asOfLabel) {
      return draftPlan.current_chain;
    }
    return null;
  });

  const upperYs = draftYs.map((v) => (v == null ? null : Math.min(100, v + slackBandPp)));
  const lowerYs = draftYs.map((v) => (v == null ? null : Math.max(0, v - slackBandPp)));

  return {
    labels,
    factYs,
    draftYs,
    approvedYs,
    upperYs,
    lowerYs,
    target: draftPlan.target,
    asOfLabel,
  };
}
