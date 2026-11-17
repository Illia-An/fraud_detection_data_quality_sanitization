import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as client from '../../api/client';
import {
  canExportPlanExcel,
  usePlannerExcelExport,
} from './usePlannerExcelExport';
import * as plannerCsv from './plannerCsv';

describe('canExportPlanExcel', () => {
  it('requires draft and non-empty panel rows', () => {
    expect(canExportPlanExcel(null, { rows: [1] })).toBe(false);
    expect(canExportPlanExcel({}, null)).toBe(false);
    expect(canExportPlanExcel({}, { rows: [] })).toBe(false);
    expect(canExportPlanExcel({}, { rows: [1] })).toBe(true);
  });
});

describe('usePlannerExcelExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads on success and sets error on failure', async () => {
    const download = vi.spyOn(plannerCsv, 'downloadBlobFile').mockImplementation(() => undefined);
    vi.spyOn(client, 'postExcelReport').mockResolvedValueOnce(new Blob(['ok']));

    const { result } = renderHook(() => usePlannerExcelExport());
    await act(async () => {
      result.current.exportExcel({
        canExport: true,
        filename: 'report.xlsx',
        buildRequest: () => ({}) as never,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'report.xlsx');
    expect(result.current.excelExportError).toBe(false);

    vi.spyOn(client, 'postExcelReport').mockRejectedValueOnce(new Error('fail'));
    await act(async () => {
      result.current.exportExcel({
        canExport: true,
        filename: 'report.xlsx',
        buildRequest: () => ({}) as never,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.excelExportError).toBe(true);
  });
});
