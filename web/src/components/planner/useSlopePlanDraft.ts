/**
 * Phase-1 Slope Plan pin draft: live preview package, lastGood rollback, generation cancel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import type { PlanPin, PlanPinKind, PinError, SlopePlanPackage } from './planTrajectoryPins';
import {
  applyDragPin,
  overlayNetworkPlanPackage,
  slopePlanContextKey,
} from './slopePlanRecompute';

export type SlopePlanDraftStatus = 'idle' | 'previewing' | 'error';

export interface UseSlopePlanDraftResult {
  displayLayers: CumulativeSlopePlotLayers | null;
  pins: PlanPin[];
  lastGood: SlopePlanPackage | null;
  preview: SlopePlanPackage | null;
  byStore: SlopePlanPackage['byStore'];
  status: SlopePlanDraftStatus;
  error: PinError | null;
  dirty: boolean;
  generation: number;
  previewDrag: (kind: PlanPinKind, monthIndex: number, value: number) => void;
  endDrag: (kind: PlanPinKind, monthIndex: number, value: number) => void;
  cancelDrag: () => void;
  resetPins: () => void;
  bumpGeneration: () => void;
}

export function useSlopePlanDraft(
  baselineLayers: CumulativeSlopePlotLayers | null,
  sim: SimulationResponse | null,
): UseSlopePlanDraftResult {
  const [generation, setGeneration] = useState(0);
  const [pins, setPins] = useState<PlanPin[]>([]);
  const [lastGood, setLastGood] = useState<SlopePlanPackage | null>(null);
  const [preview, setPreview] = useState<SlopePlanPackage | null>(null);
  const [status, setStatus] = useState<SlopePlanDraftStatus>('idle');
  const [error, setError] = useState<PinError | null>(null);
  const draggingRef = useRef(false);
  const contextKey = slopePlanContextKey(sim);
  const baselineRef = useRef(baselineLayers);
  const simRef = useRef(sim);
  const lastGoodRef = useRef<SlopePlanPackage | null>(null);
  const pinsRef = useRef<PlanPin[]>([]);
  baselineRef.current = baselineLayers;
  simRef.current = sim;
  lastGoodRef.current = lastGood;
  pinsRef.current = pins;

  const resetAll = useCallback(() => {
    draggingRef.current = false;
    setPins([]);
    setLastGood(null);
    setPreview(null);
    setStatus('idle');
    setError(null);
    setGeneration((g) => g + 1);
  }, []);

  useEffect(() => {
    resetAll();
  }, [contextKey, resetAll]);

  const bumpGeneration = useCallback(() => {
    draggingRef.current = false;
    setGeneration((g) => g + 1);
  }, []);

  const cancelDrag = useCallback(() => {
    draggingRef.current = false;
    setGeneration((g) => g + 1);
    setPreview(lastGoodRef.current);
    setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
  }, []);

  const resetPins = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const runRecompute = useCallback(
    (kind: PlanPinKind, monthIndex: number, value: number, mode: 'preview' | 'commit') => {
      const layers = baselineRef.current;
      const simulation = simRef.current;
      if (!layers || !simulation) return;
      const basePins = lastGoodRef.current?.pins ?? pinsRef.current;
      const result = applyDragPin(layers, simulation, basePins, kind, monthIndex, value);
      if (!result.ok) {
        setPreview(lastGoodRef.current);
        setError(result.error);
        setStatus('error');
        if (mode === 'commit') {
          draggingRef.current = false;
        }
        return;
      }
      setError(null);
      setPreview(result.package);
      if (mode === 'preview') {
        setStatus('previewing');
        return;
      }
      setLastGood(result.package);
      setPins(result.package.pins);
      setStatus('idle');
      draggingRef.current = false;
    },
    [],
  );

  const previewDrag = useCallback(
    (kind: PlanPinKind, monthIndex: number, value: number) => {
      draggingRef.current = true;
      runRecompute(kind, monthIndex, value, 'preview');
    },
    [runRecompute],
  );

  const endDrag = useCallback(
    (kind: PlanPinKind, monthIndex: number, value: number) => {
      runRecompute(kind, monthIndex, value, 'commit');
    },
    [runRecompute],
  );

  const activePackage = preview ?? lastGood;

  const displayLayers = useMemo(() => {
    if (!baselineLayers) return null;
    if (!activePackage) return baselineLayers;
    return overlayNetworkPlanPackage(baselineLayers, activePackage);
  }, [baselineLayers, activePackage]);

  const dirty =
    (lastGood?.pins.length ?? 0) > 0 ||
    (preview?.pins.length ?? 0) > 0 ||
    status === 'previewing';

  return {
    displayLayers,
    pins: activePackage?.pins ?? pins,
    lastGood,
    preview,
    byStore: activePackage?.byStore ?? null,
    status,
    error,
    dirty,
    generation,
    previewDrag,
    endDrag,
    cancelDrag,
    resetPins,
    bumpGeneration,
  };
}
