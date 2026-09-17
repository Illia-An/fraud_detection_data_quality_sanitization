import { useEffect, useRef } from 'react';

import { useProcess } from '../api/hooks';
import type { PipelineConfig, ProcessResponse } from '../schemas/api';
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

export function usePipelineRunner(config: PipelineConfig): PipelineRunner {
  const lastPreset = useUiStore((state) => state.lastPreset);
  const surveyRows = useUiStore((state) => state.surveyRows);
  const sampleMeta = useUiStore((state) => state.sampleMeta);
  const sampleGeneration = useUiStore((state) => state.sampleGeneration);
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
      useDbSource
        ? { source: 'db', rows: [], config }
        : { source: 'inline', rows: surveyRows, config },
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
  ]);

  const handleRun = () => {
    if (!canRun) {
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      useDbSource
        ? { source: 'db', rows: [], config }
        : { source: 'inline', rows: surveyRows, config },
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
