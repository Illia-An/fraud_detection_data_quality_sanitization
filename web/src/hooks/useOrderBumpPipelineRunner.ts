import { useEffect, useRef } from 'react';

import { useProcessOrderBump } from '../api/hooks';
import type {
  OrderBumpPipelineConfig,
  OrderBumpProcessResponse,
  OrderBumpRow,
} from '../schemas/ttsOrderBump';
import { useOrderBumpUiStore } from '../store/ttsOrderBumpUiStore';

export interface OrderBumpPipelineRunner {
  canRun: boolean;
  noData: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  displayResult: OrderBumpProcessResponse | null;
  handleRun: (overrideConfig?: OrderBumpPipelineConfig) => void;
}

export function useOrderBumpPipelineRunner(
  config: OrderBumpPipelineConfig,
): OrderBumpPipelineRunner {
  const bumpRows = useOrderBumpUiStore((s) => s.bumpRows);
  const sampleGeneration = useOrderBumpUiStore((s) => s.sampleGeneration);
  const processResult = useOrderBumpUiStore((s) => s.processResult);
  const setProcessResult = useOrderBumpUiStore((s) => s.setProcessResult);

  const { mutate, isPending, isError, error, data, reset } = useProcessOrderBump();
  const autoRunKeyRef = useRef<number | null>(null);

  const canRun = bumpRows.length > 0;

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
    if (processResult != null) {
      autoRunKeyRef.current = sampleGeneration;
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate({
      source: 'inline',
      rows: bumpRows as OrderBumpRow[],
      config,
    });
  }, [
    canRun,
    isPending,
    sampleGeneration,
    processResult,
    reset,
    mutate,
    config,
    bumpRows,
  ]);

  const handleRun = (overrideConfig?: OrderBumpPipelineConfig) => {
    if (!canRun) {
      return;
    }
    const runConfig = overrideConfig ?? config;
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate({
      source: 'inline',
      rows: bumpRows,
      config: runConfig,
    });
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
