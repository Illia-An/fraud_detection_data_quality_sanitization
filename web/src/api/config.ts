/**
 * API origin for fetch calls.
 * - Local Vite (unset): http://127.0.0.1:8001
 * - Docker monolith: build with mode `docker` / empty VITE_API_BASE_URL → same-origin
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw === undefined) {
    return 'http://127.0.0.1:8001';
  }
  const trimmed = String(raw).replace(/\/$/, '');
  // Explicit empty = same origin (monolith serves UI + API together).
  return trimmed;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const API_PREFIX = '/api/v1';
