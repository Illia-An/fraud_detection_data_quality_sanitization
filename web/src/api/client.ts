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
import {
  excelReportRequestSchema,
  type ExcelReportRequest,
} from '../schemas/excelReport';
import { planRequestSchema, planResponseSchema, type PlanRequest, type PlanResponse } from '../schemas/plan';
import {
  ttsPlanRequestSchema,
  ttsPlanResponseSchema,
  type TtsPlanRequest,
  type TtsPlanResponse,
} from '../schemas/ttsPlan';
import {
  ttsKpiPanelSchema,
  ttsKpiPresetSchema,
  type TtsKpiPanel,
  type TtsKpiPreset,
} from '../schemas/ttsKpiPanel';
import {
  kitchenBeforeAfterSchema,
  type KitchenBeforeAfter,
} from '../schemas/ttsKitchen';

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

export function postProcess(request: ProcessRequest): Promise<ProcessResponse> {
  const body = processRequestSchema.parse(request);
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/process`, processResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const EXCEL_MEDIA_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function postExcelReport(request: ExcelReportRequest): Promise<Blob> {
  const body = excelReportRequestSchema.parse(request);
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/reports/excel`, {
    method: 'POST',
    headers: {
      Accept: EXCEL_MEDIA_TYPE,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }
  return response.blob();
}

export function postPlan(request: PlanRequest): Promise<PlanResponse> {
  const body = planRequestSchema.parse(request);
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/plans`, planResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postTtsPlan(request: TtsPlanRequest): Promise<TtsPlanResponse> {
  const body = ttsPlanRequestSchema.parse(request);
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/plans-tts`, ttsPlanResponseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function parseProcessRequest(input: unknown): ProcessRequest {
  return processRequestSchema.parse(input);
}

export function parsePipelineConfig(input: unknown): PipelineConfig {
  return pipelineConfigSchema.parse(input);
}

export function fetchTtsKpiPanel(preset: TtsKpiPreset): Promise<TtsKpiPanel> {
  const validPreset = ttsKpiPresetSchema.parse(preset);
  return fetchJson(
    `${API_BASE_URL}${API_PREFIX}/sample/tts-kpi/${validPreset}`,
    ttsKpiPanelSchema,
  );
}

export function fetchTtsKpiFromAp(): Promise<TtsKpiPanel> {
  return fetchJson(`${API_BASE_URL}${API_PREFIX}/tts-kpi/ap`, ttsKpiPanelSchema);
}

export function fetchKitchenBeforeAfter(minSec: number): Promise<KitchenBeforeAfter> {
  const params = new URLSearchParams({ min_sec: String(minSec) });
  return fetchJson(
    `${API_BASE_URL}${API_PREFIX}/tts-kitchen/before-after?${params}`,
    kitchenBeforeAfterSchema,
  );
}
