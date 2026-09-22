import { useEffect, useRef } from 'react';

import { useProcess } from '../api/hooks';
import type { PipelineConfig, ProcessRequest, ProcessResponse } from '../schemas/api';
import {
  periodFieldsForProcess,
  resolvePeriodWindow,
  type PeriodPreset,
} from '../schemas/period';
import { useUiStore } from '../store/uiStore';

export interface PipelineRunner {
  canRun: boolean;
  noData: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  displayResult: ProcessResponse | null;
  handleRun: () => void;
}

function buildProcessRequest(
  config: PipelineConfig,
  options: {
    useDbSource: boolean;
    surveyRows: ProcessRequest['rows'];
    periodPreset: PeriodPreset;
    customFromDate: string;
    customToDate: string;
  },
): ProcessRequest {
  if (!options.useDbSource) {
    return { source: 'inline', rows: options.surveyRows, config };
  }
  const window = resolvePeriodWindow(
    options.periodPreset,
    options.customFromDate,
    options.customToDate,
  );
  return {
    source: 'db',
    rows: [],
    config,
    ...periodFieldsForProcess(window),
  };
}

export function usePipelineRunner(config: PipelineConfig): PipelineRunner {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const sampleGeneration = useUiStore((state) => state.sampleGeneration);
  const periodPreset = useUiStore((state) => state.periodPreset);
  const customFromDate = useUiStore((state) => state.customFromDate);
  const customToDate = useUiStore((state) => state.customToDate);
  const processResult = useUiStore((state) => state.processResult);
  const setProcessResult = useUiStore((state) => state.setProcessResult);

  const { mutate, isPending, isError, error, data, reset } = useProcess();
  const autoRunKeyRef = useRef<number | null>(null);

  const useDbSource = lastPreset === 'db';
  const canRun = useDbSource
    ? Boolean(sampleMeta && sampleMeta.row_count > 0)
    : surveyRows.length > 0;

  useEffect(() => {
    if (data) {
      setProcessResult(data);
    }
  }, [data, setProcessResult]);

  useEffect(() => {
    if (!canRun || isPending || sampleGeneration === 0) {
      return;
    }
    if (autoRunKeyRef.current === sampleGeneration) {
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      buildProcessRequest(config, {
        useDbSource,
        surveyRows,
        periodPreset,
        customFromDate,
        customToDate,
      }),
    );
  }, [
    canRun,
    isPending,
    sampleGeneration,
    reset,
    mutate,
    useDbSource,
    config,
    surveyRows,
    periodPreset,
    customFromDate,
    customToDate,
  ]);

  const handleRun = () => {
    if (!canRun) {
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      buildProcessRequest(config, {
        useDbSource,
        surveyRows,
        periodPreset,
        customFromDate,
        customToDate,
      }),
    );
  };

  return {
    canRun,
    noData: !canRun,
    isPending,
    isError,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    displayResult: data ?? processResult,
    handleRun,
  };
}
