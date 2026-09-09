import { z, type ZodTypeAny } from 'zod';

import { API_BASE_URL, API_PREFIX } from './config';
import {
  healthResponseSchema,
  pipelineConfigSchema,
  processRequestSchema,
  processResponseSchema,
  sampleDbParamsSchema,
  samplePresetSchema,
  sampleResponseSchema,
  type HealthResponse,
  type PipelineConfig,
  type ProcessRequest,
  type ProcessResponse,
  type SampleDbParams,
  type SamplePreset,
  type SampleResponse,
} from '../schemas/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T extends ZodTypeAny>(
  url: string,
  schema: T,
  init?: RequestInit,
): Promise<z.output<T>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(response.status, text || response.statusText);
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : text || response.statusText;
    throw new ApiError(response.status, detail);
  }

  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(response.status, `Invalid API response: ${error.message}`);
    }
    throw error;
  }
}

export function fetchHealth(): Promise<HealthResponse> {
  return fetchJson(`${API_BASE_URL}/health`, healthResponseSchema);
}

export function fetchSample(preset: SamplePreset): Promise<SampleResponse> {
  const validPreset = samplePresetSchema.parse(preset);
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/sample/${validPreset}`, sampleResponseSchema);
}

export function fetchSampleDb(params: SampleDbParams = {}): Promise<SampleResponse> {
  const parsed = sampleDbParamsSchema.parse(params);
  const query = new URLSearchParams();
  if (parsed.store != null) {
    query.set('store', String(parsed.store));
  }
  if (parsed.year != null) {
    query.set('year', String(parsed.year));
  }
  if (parsed.month != null) {
    query.set('month', String(parsed.month));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return fetchJson(
    `${API_BASE_URL}${API_PREFIX}/sample/db${suffix}`,
    sampleResponseSchema,
  );
}

/** Map legacy nested UI config → SPEC flat PipelineConfig for POST /process. */
export function toApiPipelineConfig(config: PipelineConfig): Record<string, unknown> {
  const nested = config as PipelineConfig & {
    tier1?: {
      enable_blacklist?: boolean;
      enable_always_topbox?: boolean;
      freq_store_day_min?: number;
      always_topbox_min_n?: number;
    };
    tier2?: {
      min_volume?: number;
      z_high?: number;
      five_pct_min?: number;
    };
  };

  if (nested.tier1 != null && nested.tier2 != null) {
    return {
      tier1_blacklist_enabled: nested.tier1.enable_blacklist ?? true,
      tier1_freq_threshold: nested.tier1.freq_store_day_min ?? 3,
      tier1_always_five_enabled: nested.tier1.enable_always_topbox ?? false,
      tier1_always_five_min_n: nested.tier1.always_topbox_min_n ?? 10,
      tier2_min_volume: nested.tier2.min_volume ?? 30,
      tier2_z_threshold: nested.tier2.z_high ?? 2.0,
      tier2_pct_threshold: nested.tier2.five_pct_min ?? 90.0,
    };
  }

  return { ...config };
}

export function postProcess(request: ProcessRequest): Promise<ProcessResponse> {
  const body = processRequestSchema.parse(request);
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/process`, processResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      config: toApiPipelineConfig(body.config),
    }),
  });
}

export function parseProcessRequest(input: unknown): ProcessRequest {
  return processRequestSchema.parse(input);
}

export function parsePipelineConfig(input: unknown): PipelineConfig {
  return pipelineConfigSchema.parse(input);
}
