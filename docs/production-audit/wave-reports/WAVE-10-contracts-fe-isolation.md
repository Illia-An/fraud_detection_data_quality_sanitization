# Wave 10 report — Contracts & FE isolation

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | C-01, C-02, T-08, T-09, T-11 |

## Goal

Contract discipline + FE fault isolation without requiring a live backend for unit fault cases; e2e for TTS/Kitchen smoke; coverage floors in CI.

## What we did

| # | Work | Result |
|---|------|--------|
| 10.1 | OpenAPI ↔ Zod critical keys | **Done** — shared `contracts/critical-response-keys.json`; pytest + vitest assert schema properties |
| 10.2 | MSW fault harness (422/503/latency) | **Done** — `web/src/test/msw/*` + `faultHarness.test.ts` |
| 10.3 | TTS / Kitchen e2e | **Done** — `tts-planner.spec.ts`, `tts-kitchen.spec.ts` (Kitchen asserts prototype badge) |
| 10.4 | Coverage thresholds | **Done** — pytest `--cov-fail-under=80`; vitest lines/statements/branches/functions 75/75/75/70 |

Extra: T-11 — `ytd_2026` preset resolves to **current calendar year** (2027+ case in `period.test.ts`).

## What changed (highlights)

| Path | Change |
|------|--------|
| `contracts/critical-response-keys.json` | **Added** — single source for C-01 |
| `tests/test_openapi_zod_contract.py` | **Added** |
| `web/src/schemas/criticalContract.test.ts` | **Added** |
| `web/src/test/msw/*` | **Added** — handlers, faults, server, harness tests |
| `web/tests/e2e/tts-planner.spec.ts` | **Added** |
| `web/tests/e2e/tts-kitchen.spec.ts` | **Added** |
| `web/vite.config.ts` / `package.json` | coverage config + `test:coverage` |
| `pyproject.toml` / `uv.lock` | `pytest-cov`; cov fail-under 80 |
| `.github/workflows/ci.yml` | contract step; FE `test:coverage` |

## Verification

```text
.\.venv\Scripts\python.exe -m pytest tests -q
→ 228 passed; Total coverage 89.30% (≥ 80%)

cd web; npm run test:coverage
→ 336 passed; lines/statements ~83.9%, branches ~80.6%, functions ~77.6%
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| Critical OpenAPI keys checked in CI | **Yes** |
| Shared 422/503/latency harness | **Yes** (MSW) |
| TTS + Kitchen e2e smoke | **Yes** |
| Coverage floors in CI | **Yes** |

## Follow-ups

- Expand MSW beyond health/process when screens need FE-only demos
- Kitchen full before/after e2e when prototype badge is removed
- Raise cov floors gradually; omit dead modules (`fraud_guard.aggregate`) if needed
- Go-live gate (A009) + single PR `feat/prod-source-truth` → `main`
