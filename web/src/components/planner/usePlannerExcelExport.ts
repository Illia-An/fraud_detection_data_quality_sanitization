import { useCallback, useState } from 'react';

import { postExcelReport } from '../../api/client';
import type { ExcelReportRequest } from '../../schemas/excelReport';
import { downloadBlobFile } from './plannerCsv';

export function panelHasRows(panel: { rows: readonly unknown[] } | null | undefined): boolean {
  return panel != null && panel.rows.length > 0;
}

export function canExportPlanExcel(
  draftPlan: unknown,
  panel: { rows: readonly unknown[] } | null | undefined,
): boolean {
  return draftPlan != null && panelHasRows(panel);
}

/**
 * Excel export busy/error flags shared by Planner and TTS Planner.
 * Request builders stay on the page (metric-specific).
 */
export function usePlannerExcelExport() {
  const [excelExporting, setExcelExporting] = useState(false);
  const [excelExportError, setExcelExportError] = useState(false);

  const exportExcel = useCallback(
    (opts: {
      canExport: boolean;
      filename: string;
      buildRequest: () => ExcelReportRequest;
    }) => {
      if (!opts.canExport || excelExporting) {
        return;
      }
      setExcelExportError(false);
      setExcelExporting(true);
      void postExcelReport(opts.buildRequest())
        .then((blob) => {
          downloadBlobFile(blob, opts.filename);
        })
        .catch(() => {
          setExcelExportError(true);
        })
        .finally(() => {
          setExcelExporting(false);
        });
    },
    [excelExporting],
  );

  return {
    excelExporting,
    excelExportError,
    exportExcel,
  };
}
