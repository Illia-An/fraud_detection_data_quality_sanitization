import { useMutation, useQuery } from '@tanstack/react-query';

import {
  fetchHealth,
  fetchSample,
  fetchSampleDb,
  fetchTtsKpiFromAp,
  fetchTtsKpiPanel,
  fetchKitchenBeforeAfter,
  postPlan,
  postPlanVersion,
  postProcess,
  postSimulation,
  postSimulationAdjust,
  postTtsPlan,
} from './client';
import {
  sampleDbParamsSchema,
  type ProcessRequest,
  type SampleDbParams,
  type SamplePreset,
} from '../schemas/api';
import type { SimulationAdjustRequest } from '../schemas/cumulativePlan';
import type { PlanRequest } from '../schemas/plan';
import type { TtsPlanRequest } from '../schemas/ttsPlan';
import type { TtsKpiPreset } from '../schemas/ttsKpiPanel';
import type { KitchenBeforeAfter } from '../schemas/ttsKitchen';

export const queryKeys = {
  health: ['health'] as const,
  sample: (preset: SamplePreset) => ['sample', preset] as const,
  sampleDb: (params: SampleDbParams = {}) => {
    const parsed = sampleDbParamsSchema.parse(params);
    return [
      'sample',
      'db',
      parsed.store ?? null,
      parsed.year ?? null,
      parsed.month ?? null,
    ] as const;
  },
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSample(preset: SamplePreset, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sample(preset),
    queryFn: () => fetchSample(preset),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSampleDb(params: SampleDbParams = {}, enabled = true) {
  const parsed = sampleDbParamsSchema.parse(params);
  return useQuery({
    queryKey: queryKeys.sampleDb(parsed),
    queryFn: () => fetchSampleDb(parsed),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useProcess() {
  return useMutation({
    mutationFn: (request: ProcessRequest) => postProcess(request),
  });
}

export function usePlan() {
  return useMutation({
    mutationFn: (request: PlanRequest) => postPlan(request),
  });
}

export function useSavePlanVersion() {
  return useMutation({
    mutationFn: postPlanVersion,
  });
}

export function useRunSimulation() {
  return useMutation({
    mutationFn: postSimulation,
  });
}

export function useAdjustSimulation() {
  return useMutation({
    mutationFn: (request: SimulationAdjustRequest) => postSimulationAdjust(request),
  });
}

export function useTtsPlan() {
  return useMutation({
    mutationFn: (request: TtsPlanRequest) => postTtsPlan(request),
  });
}

export function useLoadTtsKpiPanel() {
  return useMutation({
    mutationFn: (preset: TtsKpiPreset) => fetchTtsKpiPanel(preset),
  });
}

export function useLoadTtsKpiFromAp() {
  return useMutation({
    mutationFn: () => fetchTtsKpiFromAp(),
  });
}

export function useKitchenBeforeAfter() {
  return useMutation({
    mutationFn: (minSec: number): Promise<KitchenBeforeAfter> => fetchKitchenBeforeAfter(minSec),
  });
}
