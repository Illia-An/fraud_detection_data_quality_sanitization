/**
 * Wave 10 / C-01 — Zod side of critical OpenAPI keys (contracts/critical-response-keys.json).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { healthResponseSchema, processResponseSchema } from './api';
import { planResponseSchema } from './plan';
import { kitchenBeforeAfterSchema } from './ttsKitchen';
import { ttsKpiPanelSchema } from './ttsKpiPanel';
import { ttsPlanResponseSchema } from './ttsPlan';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const contractPath = path.join(repoRoot, 'contracts', 'critical-response-keys.json');

const zodBySchema: Record<string, z.ZodTypeAny> = {
  HealthResponse: healthResponseSchema,
  SanitizationResponse: processResponseSchema,
  PlanResponse: planResponseSchema,
  TtsPlanResponse: ttsPlanResponseSchema,
  // AP panel uses the shared panel schema (preset may be "ap").
  TtsKpiApPanelResponse: ttsKpiPanelSchema,
  KitchenBeforeAfterResponse: kitchenBeforeAfterSchema,
};

function schemaShapeKeys(schema: z.ZodTypeAny): string[] | null {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }
  return null;
}

describe('critical OpenAPI ↔ Zod keys', () => {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
    checks: Array<{ schema: string; critical_keys: string[] }>;
  };

  it('loads the shared contract file', () => {
    expect(contract.checks.length).toBeGreaterThanOrEqual(4);
  });

  for (const check of (
    JSON.parse(readFileSync(contractPath, 'utf8')) as {
      checks: Array<{ schema: string; critical_keys: string[] }>;
    }
  ).checks) {
    it(`${check.schema} Zod object exposes critical keys`, () => {
      const zodSchema = zodBySchema[check.schema];
      expect(zodSchema, `missing Zod map for ${check.schema}`).toBeTruthy();
      const keys = schemaShapeKeys(zodSchema);
      expect(keys, `${check.schema} must be a ZodObject`).not.toBeNull();
      const missing = check.critical_keys.filter((k) => !keys!.includes(k));
      expect(missing).toEqual([]);
    });
  }
});
