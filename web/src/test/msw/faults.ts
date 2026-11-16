/**
 * Shared MSW fault catalog (Wave 10 / C-02): 422, 503, latency — not per-screen.
 */
import { http, HttpResponse, delay, type JsonBodyType } from 'msw';

import { API_BASE_URL, API_PREFIX } from '../../api/config';

const api = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export type FaultKind = 'validation' | 'unavailable' | 'latency';

export interface FaultOptions {
  /** Extra delay in ms (default 25 for latency, 0 otherwise). */
  latencyMs?: number;
  detail?: string;
}

/** Handler that returns HTTP 422 with FastAPI-style detail. */
export function validationFault(
  method: 'get' | 'post',
  path: string,
  options: FaultOptions = {},
) {
  const detail = options.detail ?? 'validation failed';
  const run = async () => {
    if (options.latencyMs) {
      await delay(options.latencyMs);
    }
    return HttpResponse.json({ detail }, { status: 422 });
  };
  return method === 'get' ? http.get(api(path), run) : http.post(api(path), run);
}

/** Handler that returns HTTP 503. */
export function unavailableFault(
  method: 'get' | 'post',
  path: string,
  options: FaultOptions = {},
) {
  const detail = options.detail ?? 'service unavailable';
  const run = async () => {
    if (options.latencyMs) {
      await delay(options.latencyMs);
    }
    return HttpResponse.json({ detail }, { status: 503 });
  };
  return method === 'get' ? http.get(api(path), run) : http.post(api(path), run);
}

/** Handler that delays then returns 200 JSON. */
export function latencyOk(
  method: 'get' | 'post',
  path: string,
  body: JsonBodyType,
  latencyMs = 50,
) {
  const run = async () => {
    await delay(latencyMs);
    return HttpResponse.json(body);
  };
  return method === 'get' ? http.get(api(path), run) : http.post(api(path), run);
}

/** Convenience: process endpoint fault presets. */
export function processFault(kind: FaultKind, options: FaultOptions = {}) {
  const path = `${API_PREFIX}/process`;
  if (kind === 'validation') {
    return validationFault('post', path, options);
  }
  if (kind === 'unavailable') {
    return unavailableFault('post', path, options);
  }
  return latencyOk('post', path, { ignored: true }, options.latencyMs ?? 50);
}
