# Wave 9 report — Performance & scale (metrics-driven)

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | P-01, P-02, P-04, P-05, A007 |

## Goal

Measure `/process` p95; apply cheap mitigations; **no queue “just in case”**.

## What we did

| # | Work | Result |
|---|------|--------|
| 9.1 | Gate `tracemalloc` | **Done** — `PROFILE_TRACEMALLOC` (default off); wall-clock always; `peak_memory_mb` omitted unless on |
| 9.2 | Cap/disable large inline; body limit | **Done** — default 15k rows / 8 MiB body; `PROCESS_ALLOW_INLINE=0`; `extra="ignore"`; plan baselines ≤2k |
| 9.3 | Optional uvicorn workers 2–4 | **Done** — `UVICORN_WORKERS` via `scripts/docker_entrypoint.py` (default 1) |
| 9.4 | Result cache if p95 poor | **Done** — cold `from_2025` p95 ≫ 5s SLA → LRU cache on (opt-out `PROCESS_RESULT_CACHE=0`) |
| 9.5 | Celery/RQ | **Deferred** — G-1 snapshot; cache + optional workers sufficient |

## Metrics (local snapshot, TestClient)

Assumed interactive SLA: **5 000 ms** server `execution_time_ms`.  
Period: default UI `from_2025` (`2025-01-01` → open). Warm-up excluded from percentiles.

| Scenario | Cache | Conc. | Runs | Server p50 / p95 (ms) | Client p95 (ms) |
|----------|-------|-------|------|------------------------|-----------------|
| Cold path | off | 1 | 5 | 21550 / **24054** | 24151 |
| Warm (after miss) | on | 1 | 8 | 0.001 / **0.001** | 46 |
| Warm concurrent | on | 5 | 10 | 0.001 / **0.002** | 343 |

Cold path: Query B ≈ 8–14 s of ~15–24 s total (`rows_scanned` ≈ 117k candidates).  
Cache hit: `meta.result_cache=hit`; repeat clicks / concurrent analysts stay interactive.

**Celery/RQ:** not added — first-hit cost unchanged by a queue without async UX; repeats fixed by P-04; G-1 remains snapshot-only.

## What changed (highlights)

| Path | Change |
|------|--------|
| `backend/profiler.py` | Gate tracemalloc; optional `peak_memory_mb` |
| `backend/request_limits.py` | 8 MiB / 15k rows / inline allow / plan baseline cap |
| `backend/schemas.py` | `extra="ignore"`; row/inline validators |
| `backend/process_cache.py` | **Added** — snapshot `source=db` LRU |
| `backend/service.py` | Cache miss/hit wiring; `result_cache` meta |
| `scripts/docker_entrypoint.py` | **Added** — `UVICORN_WORKERS` |
| `Dockerfile` / `docker-compose.yml` | Entrypoint + env knobs |
| `scripts/measure_process_latency.py` | **Added** — p50/p95 harness |
| `web/src/schemas/api.ts` | Optional peak; max 15k; strip unknown row fields |
| `tests/test_wave9_performance.py` | **Added** |

## Verification

```text
.\.venv\Scripts\python.exe -m pytest tests -q
→ 226 passed

.\.venv\Scripts\python.exe scripts/measure_process_latency.py --runs 5 --no-cache
→ cold server p95 ≈ 24s

.\.venv\Scripts\python.exe scripts/measure_process_latency.py --runs 8
→ warm server p95 ≈ 0.001 ms

cd web; npm run test:run
→ 322 passed (after Zod strip-extra expectation update)
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| p95 measured | **Yes** (cold + warm + conc=5) |
| No queue just in case | **Yes** — Celery/RQ deferred |
| Cheap mitigations shipped | **Yes** — P-01, P-02/P-05, workers knob, P-04 cache |

## Follow-ups

- Cold first-hit on full `from_2025` still ~15–24 s — consider Query B indexes / narrower default period (ops/product), not a queue
- Tune `UVICORN_WORKERS=2–4` on the deploy host if concurrent cold misses appear
- Owner may set `PROCESS_ALLOW_INLINE=0` on hardened LAN images
- Wave 10 — contracts / FE isolation
