/**
 * Wave 10 / C-02 — prove shared MSW fault harness (422 / 503 / latency).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError, fetchHealth, postProcess } from '../../api/client';
import { defaultPipelineConfig } from '../../schemas/api';
import { latencyOk, processFault, unavailableFault, validationFault } from './faults';
import { healthOk } from './handlers';
import { mswServer } from './server';

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});

describe('MSW fault harness', () => {
  it('happy-path health returns Zod-valid payload', async () => {
    const health = await fetchHealth();
    expect(health.status).toBe('ok');
    expect(health.version).toBe(healthOk.version);
  });

  it('maps HTTP 422 to ApiError', async () => {
    mswServer.use(validationFault('get', '/health', { detail: 'bad health' }));
    await expect(fetchHealth()).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'bad health',
    } satisfies Partial<ApiError>);
  });

  it('maps HTTP 503 on /process to ApiError', async () => {
    mswServer.use(processFault('unavailable', { detail: 'snapshot missing' }));
    await expect(
      postProcess({
        source: 'db',
        rows: [],
        config: defaultPipelineConfig,
        from_date: '2025-01-01',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      message: 'snapshot missing',
    });
  });

  it('latency handler delays before resolving', async () => {
    mswServer.use(latencyOk('get', '/health', healthOk, 40));
    const started = performance.now();
    const health = await fetchHealth();
    const elapsed = performance.now() - started;
    expect(health.status).toBe('ok');
    expect(elapsed).toBeGreaterThanOrEqual(35);
  });

  it('unavailableFault helper works for arbitrary paths', async () => {
    mswServer.use(unavailableFault('get', '/health'));
    await expect(fetchHealth()).rejects.toMatchObject({ status: 503 });
  });
});
