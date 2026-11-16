# Wave 3 report — Security P0

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | S-01, S-02 P0, S-03, S-06, S-07, S-08, T-04 |

## Goal

Close cheap, high-impact holes before the port is reachable beyond the laptop.

## What we did

| # | Work | Result |
|---|------|--------|
| 3.1 | SPA path containment + test | **Done** — `safe_dist_file` + traversal tests |
| 3.2 | Non-root `USER` in Docker | **Done** — `appuser` uid 10001 |
| 3.3 | Strip notebook PII outputs; history decision | **Done** — outputs cleared; **no history rewrite** recorded |
| 3.4 | Network lock in runbook | **Done** — procedure in `WAVE-0-DECISIONS.md` (`NET` = DOCUMENTED) |
| 3.5 | `npm audit --omit=dev` + CI gate | **Done** — `npm run audit:prod` + allowlist for plotly→maplibre |
| 3.6 | Body/row limits baseline | **Done** — 50k rows; 32 MiB body (env overrides) |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/static_ui.py` | Path containment |
| `backend/request_limits.py` | **Added** — Content-Length 413 middleware |
| `backend/main.py` | Mount body-size middleware |
| `backend/schemas.py` | `rows` max 50_000 |
| `Dockerfile` | Non-root `USER appuser` |
| `notebooks/0*.ipynb` | Outputs stripped |
| `web/package.json` / lock | `react-query-devtools` → devDependencies |
| `web/scripts/check-npm-audit.mjs` | Critical gate with GHSA allowlist |
| `web/npm-audit-allowlist.json` | maplibre via plotly (documented) |
| `.github/workflows/ci.yml` | `npm run audit:prod` |
| `docs/.../WAVE-0-DECISIONS.md` | NET procedure + S-01 history |
| `tests/test_static_ui.py` | Traversal cases |
| `tests/test_request_limits.py` | **Added** |
| `tests/test_notebooks_no_outputs.py` | **Added** |
| `web/src/schemas/api.ts` | Zod max rows 50_000 |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests/test_static_ui.py tests/test_request_limits.py tests/test_notebooks_no_outputs.py tests/test_process_api.py -v
→ 14 passed

cd web && node ./scripts/check-npm-audit.mjs
→ no unexpected critical findings
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| Traversal cannot serve outside `web/dist` | **Yes** |
| Container non-root | **Yes** (Dockerfile `USER appuser`) |
| Notebooks have no phone-like outputs | **Yes** (outputs empty) |

## Follow-ups

- Owner ACK on **NET** firewall ownership (HOST still PENDING)
- plotly.js@4 to clear maplibre critical (allowlisted today)
- zod high advisory (not critical gate); major bump deferred
- `plan_store` host dir must be writable by uid 10001 under Docker
