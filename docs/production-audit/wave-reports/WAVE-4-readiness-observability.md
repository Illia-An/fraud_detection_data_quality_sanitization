# Wave 4 report — Readiness & observability

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | D-06, OB-01, OB-03, A005, A009 #1/#6, T-05, A010 |

## Goal

Separate “process is up” from “safe to take traffic”; logs can diagnose wrong KPI / stale data.

## FRESH SLA

| Item | Value |
|------|--------|
| Status | `PROPOSED` (Wave 0) — not owner-SIGNED |
| Threshold | **14 days** |
| Override | `SNAPSHOT_MAX_AGE_DAYS` |
| Gate | `GET /ready` returns **503** when age &gt; SLA (`reason=stale`) |

## What we did

| # | Work | Result |
|---|------|--------|
| 4.1 | `GET /ready`: file, age, rows, `schema_version` | **Done** — 200 / 503 + `reasons[]` |
| 4.2 | HEALTHCHECK stays on `/health` | **Done** — unchanged; comment added |
| 4.3 | JSON logs + `request_id` | **Done** — `JsonLogFormatter`, `X-Request-ID` |
| 4.4 | `process_done` event | **Done** — one structured line per `/process` |
| 4.5 | Startup log | **Done** — lifespan `startup` (sources/schema/rows; no secrets) |
| 4.6 | UI `snapshot_loaded_at` / stale warning | **Done** — PipelineRunPanel alert |
| 4.7 | Backend `/health` test (not `api.main`) | **Done** — `tests/test_health.py` |
| 4.8 | Dockerfile `exec` uvicorn as PID 1 | **Done** — `CMD ["/app/.venv/bin/uvicorn", …]` |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/readiness.py` | **Added** — age / stale / `evaluate_readiness` |
| `backend/observability.py` | **Added** — JSON logs, request-id middleware, events |
| `backend/main.py` | `/ready`, lifespan, middleware, `process_done` |
| `backend/schemas.py` | `ReadyResponse` |
| `backend/queries.py` | meta: `snapshot_age_s` / `snapshot_stale` / max days |
| `Dockerfile` | uvicorn PID 1; HEALTHCHECK comment |
| `docker-compose.yml` | `SNAPSHOT_MAX_AGE_DAYS`, `APP_VERSION`, log rotation |
| `docs/.../WAVE-0-DECISIONS.md` | FRESH → PROPOSED 14d |
| `web/src/components/PipelineRunPanel.tsx` | freshness alert |
| `web/src/i18n/messages/{en,he}.ts` | i18n keys |
| `tests/test_ready.py` | **Added** |
| `tests/test_observability.py` | **Added** |
| `tests/test_health.py` | Retargeted to `backend.main` `/health` |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests/test_health.py tests/test_ready.py tests/test_observability.py tests/test_request_limits.py tests/test_snapshot.py -v
→ 27 passed

cd web && npm test -- --run src/components/PipelineRunPanel.test.tsx
→ 8 passed
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| Stale / missing snapshot → `/ready` ≠ 200 | **Yes** |
| `/health` stays green when not ready | **Yes** |
| Logs can diagnose wrong KPI / stale data | **Yes** (`process_done` + startup + request_id) |

## Follow-ups

- Owner **SIGN** FRESH (or change days via env / decision register)
- **ALERT** channel still PENDING (Wave 0) — probe `/ready` externally
- Wave 5: image tags, smoke `/health`+`/ready`, compose `IMAGE_TAG`
- Refresh structured events / `last_success_at` (A005 OB-07) — later wave
