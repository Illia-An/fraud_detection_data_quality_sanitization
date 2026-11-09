/** Map cleansed panel rows → cumulative-slope simulation facts. */

import type { MetricScorePanel } from '../../schemas/metricScore';
import { metricScore } from '../../schemas/metricScore';
import type { z } from 'zod';
import { storeMonthFactSchema } from '../../schemas/cumulativePlan';

type StoreMonthFact = z.infer<typeof storeMonthFactSchema>;

export function panelToSimulationFacts(panel: MetricScorePanel): StoreMonthFact[] {
  const out: StoreMonthFact[] = [];
  for (const row of panel.rows) {
    const score = metricScore(row);
    if (score == null || row.five_percent == null) {
      continue;
    }
    out.push({
      store_id: row.store_id,
      year: row.year,
      month: row.month,
      five_percent: row.five_percent,
    });
  }
  return out;
}
