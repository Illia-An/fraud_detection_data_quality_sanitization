import { useEffect, useRef } from 'react';

import { useProcessTts } from '../api/hooks';
import {
  periodFieldsForProcess,
  resolvePeriodWindow,
  type PeriodPreset,
} from '../schemas/period';
import type {
  TtsBumpRow,
  TtsPipelineConfig,
  TtsProcessRequest,
  TtsSanitizationResponse,
} from '../schemas/tts';
import { useTtsUiStore } from '../store/ttsUiStore';

export interface TtsPipelineRunCallbacks {
  onSuccess?: (data: TtsSanitizationResponse) => void;
  onError?: () => void;
}

export interface TtsPipelineRunner {
  canRun: boolean;
  noData: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  displayResult: TtsSanitizationResponse | null;
  handleRun: (overrideConfig?: TtsPipelineConfig, callbacks?: TtsPipelineRunCallbacks) => void;
  restoreDisplayResult: (result: TtsSanitizationResponse | null) => void;
}

function isTtsPipelineConfig(value: unknown): value is TtsPipelineConfig {
  return (
    value != null &&
    typeof value === 'object' &&
    'tts_min_sec' in value &&
    typeof (value as TtsPipelineConfig).tts_min_sec === 'number'
  );
}

function buildTtsProcessRequest(
  config: TtsPipelineConfig,
  options: {
    useDbSource: boolean;
    bumpRows: TtsBumpRow[];
    periodPreset: PeriodPreset;
    customFromDate: string;
    customToDate: string;
  },
): TtsProcessRequest {
  if (!options.useDbSource) {
    return { source: 'inline', rows: options.bumpRows, config };
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

export function useTtsPipelineRunner(config: TtsPipelineConfig): TtsPipelineRunner {
  const lastPreset = useTtsUiStore((state) => state.lastPreset);
  const bumpRows = useTtsUiStore((state) => state.bumpRows);
  const sampleMeta = useTtsUiStore((state) => state.sampleMeta);
  const sampleGeneration = useTtsUiStore((state) => state.sampleGeneration);
  const periodPreset = useTtsUiStore((state) => state.periodPreset);
  const customFromDate = useTtsUiStore((state) => state.customFromDate);
  const customToDate = useTtsUiStore((state) => state.customToDate);
  const processResult = useTtsUiStore((state) => state.processResult);
  const setProcessResult = useTtsUiStore((state) => state.setProcessResult);

  const { mutate, isPending, isError, error, data, reset } = useProcessTts();
  const autoRunKeyRef = useRef<number | null>(null);

  const useDbSource = lastPreset === 'db';
  const canRun = useDbSource
    ? Boolean(sampleMeta && sampleMeta.preset === 'db')
    : bumpRows.length > 0;

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
    // Remount with the same sample generation must not re-POST /process-tts.
    if (processResult != null) {
      autoRunKeyRef.current = sampleGeneration;
      return;
    }
    // DB source: wait for explicit Run (period may still be tuned).
    if (useDbSource) {
      autoRunKeyRef.current = sampleGeneration;
      return;
    }
    autoRunKeyRef.current = sampleGeneration;
    reset();
    mutate(
      buildTtsProcessRequest(config, {
        useDbSource,
        bumpRows,
        periodPreset,
        customFromDate,
        customToDate,
      }),
    );
  }, [
    canRun,
    isPending,
    sampleGeneration,
    processResult,
    reset,
    mutate,
    useDbSource,
    config,
    bumpRows,
    periodPreset,
    customFromDate,
    customToDate,
  ]);

  const handleRun = (
    overrideConfig?: TtsPipelineConfig,
    callbacks?: TtsPipelineRunCallbacks,
  ) => {
    if (!canRun) {
      return;
    }
    const runConfig = isTtsPipelineConfig(overrideConfig) ? overrideConfig : config;
    autoRunKeyRef.current = sampleGeneration;
    reset();
    const request = buildTtsProcessRequest(runConfig, {
      useDbSource,
      bumpRows,
      periodPreset,
      customFromDate,
      customToDate,
    });
    if (callbacks?.onSuccess || callbacks?.onError) {
      mutate(request, {
        onSuccess: (response) => {
          callbacks.onSuccess?.(response);
        },
        onError: () => {
          callbacks.onError?.();
        },
      });
      return;
    }
    mutate(request);
  };

  const restoreDisplayResult = (result: TtsSanitizationResponse | null) => {
    reset();
    setProcessResult(result);
  };

  return {
    canRun,
    noData: !canRun,
    isPending,
    isError,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    displayResult: data ?? processResult,
    handleRun,
    restoreDisplayResult,
  };
}
