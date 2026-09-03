import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchHealth, fetchSample, postProcess } from './client';
import type { ProcessRequest, SamplePreset } from '../schemas/api';

export const queryKeys = {
  health: ['health'] as const,
  sample: (preset: SamplePreset) => ['sample', preset] as const,
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

export function useProcess() {
  return useMutation({
    mutationFn: (request: ProcessRequest) => postProcess(request),
  });
}
