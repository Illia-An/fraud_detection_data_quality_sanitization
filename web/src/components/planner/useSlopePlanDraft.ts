/**
 * Phase-1 Slope Plan pin draft: rAF network preview, allocate on pointerup, lastGood rollback.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SimulationResponse } from '../../schemas/cumulativePlan';
import type { CumulativeSlopePlotLayers } from './cumulativeSlopeLayers';
import type { PlanPin, PlanPinKind, PinError, SlopePlanPackage } from './planTrajectoryPins';
import {
  applyDragPin,
  buildSlopeStoreAllocateInputs,
  overlayNetworkPlanPackage,
  slopePlanContextKey,
  type SlopeStoreAllocateInputs,
} from './slopePlanRecompute';

export type SlopePlanDraftStatus = 'idle' | 'previewing' | 'allocating' | 'error';

export interface UseSlopePlanDraftResult {
  displayLayers: CumulativeSlopePlotLayers | null;
  pins: PlanPin[];
  lastGood: SlopePlanPackage | null;
  preview: SlopePlanPackage | null;
  /** Store series from last committed allocate (not mid-drag network preview). */
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

interface PendingPreview {
  kind: PlanPinKind;
  monthIndex: number;
  value: number;
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
  const rafRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef<PendingPreview | null>(null);
  const allocateInputsRef = useRef<SlopeStoreAllocateInputs | null>(null);

  const contextKey = slopePlanContextKey(sim);
  const baselineRef = useRef(baselineLayers);
  const simRef = useRef(sim);
  const lastGoodRef = useRef<SlopePlanPackage | null>(null);
  const pinsRef = useRef<PlanPin[]>([]);
  baselineRef.current = baselineLayers;
  simRef.current = sim;
  lastGoodRef.current = lastGood;
  pinsRef.current = pins;

  // Cache store maps whenever layers/sim context is stable (not every pointermove).
  useEffect(() => {
    if (!baselineLayers || !sim) {
      allocateInputsRef.current = null;
      return;
    }
    allocateInputsRef.current = buildSlopeStoreAllocateInputs(baselineLayers, sim);
  }, [baselineLayers, sim, contextKey]);

  const clearRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPreviewRef.current = null;
  }, []);

  const resetAll = useCallback(() => {
    draggingRef.current = false;
    clearRaf();
    setPins([]);
    setLastGood(null);
    setPreview(null);
    setStatus('idle');
    setError(null);
    setGeneration((g) => g + 1);
  }, [clearRaf]);

  useEffect(() => {
    resetAll();
  }, [contextKey, resetAll]);

  useEffect(() => () => clearRaf(), [clearRaf]);

  const bumpGeneration = useCallback(() => {
    draggingRef.current = false;
    clearRaf();
    setGeneration((g) => g + 1);
  }, [clearRaf]);

  const cancelDrag = useCallback(() => {
    draggingRef.current = false;
    clearRaf();
    setGeneration((g) => g + 1);
    setPreview(lastGoodRef.current);
    setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
  }, [clearRaf]);

  const resetPins = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const flushNetworkPreview = useCallback(() => {
    rafRef.current = null;
    const pending = pendingPreviewRef.current;
    pendingPreviewRef.current = null;
    if (!pending) return;
    const layers = baselineRef.current;
    const simulation = simRef.current;
    if (!layers || !simulation) return;
    const basePins = lastGoodRef.current?.pins ?? pinsRef.current;
    const result = applyDragPin(
      layers,
      simulation,
      basePins,
      pending.kind,
      pending.monthIndex,
      pending.value,
      'network',
      allocateInputsRef.current,
    );
    if (!result.ok) {
      setPreview(lastGoodRef.current);
      setError(result.error);
      setStatus('error');
      return;
    }
    setError(null);
    setPreview(result.package);
    setStatus('previewing');
  }, []);

  const previewDrag = useCallback(
    (kind: PlanPinKind, monthIndex: number, value: number) => {
      draggingRef.current = true;
      pendingPreviewRef.current = { kind, monthIndex, value };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushNetworkPreview);
      }
    },
    [flushNetworkPreview],
  );

  const endDrag = useCallback(
    (kind: PlanPinKind, monthIndex: number, value: number) => {
      clearRaf();
      const layers = baselineRef.current;
      const simulation = simRef.current;
      if (!layers || !simulation) {
        draggingRef.current = false;
        return;
      }
      setStatus('allocating');
      const basePins = lastGoodRef.current?.pins ?? pinsRef.current;
      const result = applyDragPin(
        layers,
        simulation,
        basePins,
        kind,
        monthIndex,
        value,
        'full',
        allocateInputsRef.current,
      );
      if (!result.ok) {
        setPreview(lastGoodRef.current);
        setError(result.error);
        setStatus('error');
        draggingRef.current = false;
        return;
      }
      setError(null);
      setPreview(result.package);
      setLastGood(result.package);
      setPins(result.package.pins);
      setStatus('idle');
      draggingRef.current = false;
    },
    [clearRaf],
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
    status === 'previewing' ||
    status === 'allocating';

  return {
    displayLayers,
    pins: activePackage?.pins ?? pins,
    lastGood,
    preview,
    // Inspect / At-risk store series: last committed allocate (stable during network preview).
    byStore: lastGood?.byStore ?? null,
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
