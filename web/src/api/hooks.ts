import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchHealth, fetchSample, fetchSampleDb, postProcess } from './client';
import {
  sampleDbParamsSchema,
  type ProcessRequest,
  type SampleDbParams,
  type SamplePreset,
} from '../schemas/api';

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
    gcTime: 0,
  });
}

export function useProcess() {
  return useMutation({
    mutationFn: (request: ProcessRequest) => postProcess(request),
  });
}
