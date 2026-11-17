import { periodLabel } from '../../schemas/plan';

export type PlanCsvMonthPoint = { year: number; month: number; score: number };

export type PlanCsvProjection = {
  store_id: number;
  months: readonly PlanCsvMonthPoint[];
};

export type PlanCsvSource = {
  chain_trajectory: readonly PlanCsvMonthPoint[];
  projections: readonly PlanCsvProjection[];
};

/** Build CSV lines for store×month plan projections (chain + stores). */
export function buildPlanProjectionCsvLines(plan: PlanCsvSource): string[] {
  const periods = plan.chain_trajectory;
  const header = ['store_id', ...periods.map((p) => periodLabel(p.year, p.month))];
  const lines = [header.join(',')];
  lines.push(['chain', ...periods.map((p) => String(p.score))].join(','));
  for (const projection of plan.projections) {
    lines.push(
      [
        String(projection.store_id),
        ...periods.map((period) => {
          const hit = projection.months.find(
            (point) => point.year === period.year && point.month === period.month,
          );
          return hit ? String(hit.score) : '';
        }),
      ].join(','),
    );
  }
  return lines;
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8',
): void {
  downloadBlobFile(new Blob([content], { type: mimeType }), filename);
}

export function downloadPlanProjectionCsv(plan: PlanCsvSource, filename: string): void {
  downloadTextFile(buildPlanProjectionCsvLines(plan).join('\n'), filename);
}
