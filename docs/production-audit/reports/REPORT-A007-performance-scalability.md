# REPORT-A007 — Performance & Scalability: Bottlenecks, Cache, Queues

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A007](../specs/SPEC-A007-performance-scalability.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of `backend/*`, `db/*`, `src/*`, `scripts/refresh_q10012_snapshot.py`, `Dockerfile`, `docker-compose.yml`, `web/src/{api,hooks}`. **Load tests: not executed.** Latency and capacity numbers are not measured. |
| **Status** | Report ready (G-1 / concurrent users / latency SLA open) |

> **Method note.** The Cursor search index is stale (lists deleted files such as
> `backend/tts_service.py`, `backend/tts_schemas.py`). Every path below was checked with
> `Test-Path` / `git ls-files`.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (A-01/A-03, G-1),
> [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-12/D-15, refresh),
> [REPORT-A003](./REPORT-A003-security-hardening.md) (S-06/S-15),
> [REPORT-A005](./REPORT-A005-observability.md) (`process_done` log needed to measure p95).

---

## 1. Answers (explicit)

### 1.1 Where does the ceiling hit first under internal concurrency?

**First hit = in-process CPU / GIL serialization on concurrent heavy `POST /api/v1/process`**,
not “need Redis yet”.

1. With a handful of analysts on **snapshot-only**, SQLite releases the GIL during queries,
   but Python post-processing (redact → pydantic → pandas on candidate rows) holds it.
   With one uvicorn process, heavy runs queue behind each other in latency long before the
   default thread pool (~40) is exhausted.
2. The **thread pool** becomes the visible cliff if requests hang or are long — primarily
   VIEW without timeouts, or orphaned `/process` runs. Symptom: `/health` and every other
   route queue.
3. **Memory** has no container limit. A large inline body or candidate set, multiplied by
   tracemalloc overhead, can OOM the container.
4. **Under VIEW (G-1 unresolved):** a hung MSSQL query with no timeout can pin workers
   indefinitely — a hang, not a slowdown.

### 1.2 Celery / RQ for v1?

**Not needed if:**

- G-1 = production is **snapshot-only** (VIEW is dev only);
- inline is capped / lowered / disabled and body/row limits are in place (A003 S-06);
- timeouts or guards exist on any live SQL that remains;
- expected load is a handful of analysts (assumption — confirm O-1).

**Defer until** any of:

- measured p95 `/process` exceeds the agreed SLA under N concurrent users;
- any operation regularly exceeds the proxy / browser timeout;
- VIEW or live MSSQL becomes production;
- refresh or export moves behind the API.

**Why not add a queue “just in case”.** There is no OLTP result store. A queue means Redis
plus a place to persist job results — new stateful infrastructure with no proven need
(SPEC non-goal).

**What would move first (if ever):** `POST /api/v1/process` with `source=db`, and kitchen
`before-after` if it goes to production. Inline should be rejected rather than queued.
Planners and TTS KPI stay sync. Refresh scripts are already out-of-band.

**Cheaper steps before any queue:** gate tracemalloc (P-01); optional `uvicorn --workers 2–4`
(stateless app, SQLite concurrent readers); `--limit-concurrency` for load shedding; result
cache P-04 if measured.

---

## 2. Concurrency & runtime model (as-is)

| Aspect | Fact | Evidence |
|--------|------|----------|
| Process | One uvicorn process; no `--workers`; no `--limit-concurrency` | `Dockerfile:54` |
| Handlers | Sync `def` routes run in the Starlette/anyio thread pool (default ~40). SPA fallback is `async`. | `main.py:123+`, `static_ui.py:38` |
| Shared mutable state | None except process-global `tracemalloc` (P-01). `lru_cache` only on `get_settings`. | `db/config.py:22`, `profiler.py:31-48` |
| Engines | Created per call; no dispose, pool config, or timeouts. Snapshot `/process` creates up to 3 engines (Query A, Query B, `process_source_meta_extra`). | `queries.py:250,484,494-505`, `snapshot.py:113-124,196-217` |
| Production sources (Docker) | `SANITIZATION_SOURCE=snapshot`, `TTS_KPI_SOURCE=snapshot`; snapshots mounted `:ro` | `Dockerfile:33-36`, `docker-compose.yml:14-23` |
| Code default (no Docker) | `SANITIZATION_SOURCE=view` | `snapshot.py:83-88` |
| FE call pattern | `source=db` sends `rows: []`. `/process` auto-runs on sample generation. `/sample/db` has 5 min `staleTime`. No `AbortController` / client timeout. | `usePipelineRunner.ts:57-58,80-110`, `hooks.ts:58-66` |
| Container limits | None (`deploy.resources` absent) | `docker-compose.yml` |
| Snapshot size | ≈ 182 MB (`data/q10012_snapshot.sqlite`) | filesystem |
| Hot path cost (snapshot) | Query A cheap (`store_month` PK). Query B full-period scan + CTE. Then Python on candidates. | `queries.py:148-175,326-405,440-451` |
| Synthetic sizes | small ≈ 2×2×40; medium ≈ 10×6×45; stress ≈ 20×12×50 | `src/fraud_guard/synthetic.py:45-64` |

**Deleted TTS paths (do not cite).** `backend/tts_service.py`, `tts_order_bump_*`,
`tts_schemas.py` — `Test-Path` = False. Live `profile_block` call site for sanitization is
only `main.py:266`. Kitchen does not use the profiler.

---

## 3. Bottleneck registry

| ID | Bottleneck | Resource | Trigger | Evidence | Class | Severity | Effort | Mitigation |
|----|------------|----------|---------|----------|-------|----------|--------|------------|
| **P-01** (PERF-01) | Global `tracemalloc` start/stop every `/process`. Concurrent requests: one can stop tracing while another measures → wrong/zero `peak_memory_mb`; all threads pay allocator overhead while tracing is on. | CPU / telemetry correctness | ≥2 overlapping `/process` | `profiler.py:31-51`, `main.py:266,345`; UI shows RAM (`KpiCards.tsx:125`) | **Defer** (cheap pre-release fix recommended) | Med | S | Gate behind debug flag; keep field optional. Does **not** corrupt KPI values. |
| **P-02** (PERF-02) | Row-wise Python: `model_dump` × N, `iterrows` ×3, per-cell `_lookup` filter (quadratic), `tier2` list comprehension. Applies to **inline rows and snapshot Query B candidates**. | CPU/GIL, RAM | Inline up to 500k; large candidate sets (freq/always-5, long period) | `service.py:50-54,247,300-311,314,350`; `tier2.py:110-111`; `queries.py:450-451` | **Blocker\*** if 500k inline used in prod without limits; else **Defer** (UI stays `source=db`) | Med–High | S–M | Prefer `source=db`; cap/disable inline; later merge/groupby. |
| **P-03** (PERF-03) | VIEW Query B: every row where `BlackList IS NULL OR <> customer`, `ORDER BY AnswerTime`, fully into memory; no row cap; no SQL timeout. | RAM, MSSQL, worker pinning | VIEW in prod (G-1) | `queries.py:297-322,440-451` | **Blocker\*** only if VIEW is production (A001 A-03 / A002 D-15) | High | S–M | G-1 = snapshot-only; else statement timeout + row ceiling → 503/422. |
| **P-04** (PERF-04) | No cache of deterministic snapshot results. Same `(period, config)` recomputes Query B + pandas. | CPU, SQLite IO | Repeated clicks; several analysts, same period | no cache in code | **Defer** (recommendation) | Low–Med | S–M | See §4 |
| **P-05** (SEC-07) | Payload guardrails weak: inline `max_length=500_000`; `SurveyAnswerRow` `extra="allow"`; no body-size limit; no rate limit. Plan baselines only `min_length=1`. | RAM, CPU, parse time | Large / hostile body; anyone who can reach the port | `schemas.py:70,100`; `plan_schemas.py:31`; `tts_plan_schemas.py:42` | Same as A003 S-06: **Defer with P0 network lock; blocker without it** | Med | S | Body limit at proxy/uvicorn; lower row cap; `extra="ignore"`; cap baselines (S-06/S-15). |
| **P-06** (ARCH-04) | Engine-per-request; no dispose / pool / timeout. Snapshot = CPU/FD churn. VIEW = new login per request; slow query holds a worker. | CPU, FDs, connections | Every request; VIEW amplifies | `db/connection.py:6-12`; `queries.py:250,484` | **Defer** if snapshot-only; **Blocker\*** under VIEW (A001 A-03) | Low–Med | S–M | One engine per URL; dispose in lifespan; timeout. |
| **P-07** | Snapshot Query B phase 2 scans period in `answers` (default `2025-01-01`→latest), computes `entity_key` CASE, runs `GROUP BY` CTEs for freq/always-5. No index on `entity_key` / `day`. | SQLite CPU/IO per request | Tiers 2/3 on long period | `queries.py:326-405`; indexes `snapshot.py:63-68` | **Defer / Potential** (**not measured**) | Med | M | Measure first (A005 timings); then P-04 or precomputed table (A002). |
| **P-08** | `/sample/db` meta: `COUNT(DISTINCT …)` over `answers` on UI open (5 min client cache per browser). | SQLite IO | Several analysts opening UI | `db_sample.py:272-290`; `hooks.ts:58-66` | **Defer** | Low | S | Reuse `snapshot_meta` / `store_month`, or short server cache by `loaded_at`. |
| **P-09** | Orphaned work: no client timeout/abort; server cannot cancel a running sync handler. Re-runs leave prior `/process` running. | Thread pool | Impatient users; auto-run on sample change | `usePipelineRunner.ts:80-110`; no Abort in `web/src/api` | **Defer** | Low–Med | S | Server timeout/guard (P-03/P-06); optional client abort. |
| **P-10** | `/health` is sync in the same pool. Docker `HEALTHCHECK` timeout=5s, retries=3. Under saturation container can flip unhealthy (compose does not auto-restart unhealthy). | Observability / ops | Pool or CPU saturation | `main.py:123-125`; `Dockerfile:51-52`; A005 | **Defer** | Low | S | `async def` health + `/ready` (A005). |
| **P-11** | SQLite refresh writer vs readers: in-place `DELETE` + bulk `INSERT` in one transaction. Readers can hit lock at commit. Bind-mount locking unverified. | SQLite lock | Refresh during working hours | `refresh_q10012_snapshot.py:147-149` | **Defer / Potential** (ops; A002/A006) | Med | S–M | Off-hours refresh or temp file + atomic swap (A002). |
| **P-12** | Kitchen `before-after`: one aggregate SELECT on live MSSQL; no timeout; engine not disposed. Not in Docker (no ODBC). | MSSQL, worker | Kitchen used outside Docker | `tts_kitchen_queries.py:155-160,170-185` | **Defer**; **Blocker\*** if kitchen goes to prod | Med | S | Timeout + engine lifecycle. |

**Checked and not a bottleneck for v1:**

- **Planners** (`/plans`, `/plans-tts`): pure CPU on store-keyed dicts; horizon ≤12; TTS solver ≤40 iterations. Cost ≈ distinct stores + JSON parse (`main.py:371-455`, `src/planner/tts.py:123`).
- **TTS KPI**: snapshot/SQL dispose engines; DreamFactory `timeout=30` (`tts_kpi_ap.py:65-71,112`).
- **IsolationForest** (`fraud_guard/tier3.py:132-136`, `n_jobs=-1`): **not** on the live path — `backend` never calls `apply_tier3`. Note only if reconnected later.

---

## 4. Caching recommendations

| What | When | Key | Invalidate | Notes |
|------|------|-----|------------|-------|
| `/process` result (`source=db`, snapshot) | Only if measured p95 exceeds SLA | `(snapshot_loaded_at, from_date, to_date, config hash)` | New `loaded_at`; or bounded LRU | Deterministic. Per-process dict + lock. With `--workers N`, each worker has its own copy. |
| `/sample/db` meta | Optional | `(loaded_at, filters)` | New `loaded_at` | Small gain (P-08). |
| Planners | **No** | — | — | Cheap and request-specific. |
| **Do not cache** | VIEW live reads; inline results (user data / PII); kitchen live | — | — | No safe invalidation / freshness contract. |

---

## 5. Queue / background workers verdict (summary box)

```
Celery / RQ for v1:  NOT NEEDED IF
  • G-1 = snapshot-only
  • inline capped / discouraged + body/row limits
  • expected concurrent users ≈ handful of analysts
  • timeouts / guards on any remaining live SQL

DEFER UNTIL
  • measured p95 /process > SLA under N concurrent users
  • batch / refresh / export moves behind the API
  • VIEW or kitchen becomes production-critical

FIRST ENDPOINT TO MOVE (if ever): POST /api/v1/process (source=db)
```

---

## 6. Minimal pre-release perf actions vs defer

### Before internal release (no queue)

| # | Action | Ties to |
|---|--------|---------|
| 1 | Decide G-1; add VIEW guard if VIEW stays reachable | A001 A-01 / A-03 |
| 2 | Gate `tracemalloc` behind a debug flag | P-01 |
| 3 | Body-size limit; lower row cap; `extra="ignore"`; cap plan baselines — or disable inline in prod | P-05, A003 S-06/S-15 |
| 4 | Emit `process_done` timings server-side so p95 is measurable | A005 |
| 5 | One smoke capacity check (§9); record p50/p95 at 1 / 5 / 10 concurrent | P-07 |
| 6 | Set container memory limit | P-02 |
| 7 | Only if VIEW or kitchen stay: engine lifecycle, statement timeout, row ceiling | P-03, P-06, P-12 |

### Defer

Result cache (P-04); `/sample/db` cache (P-08); client abort (P-09); async `/health` (P-10 / A005 `/ready`); multi-worker tuning; Celery/RQ.

---

## 7. Re-verification of assessment findings

| Finding | Verdict | Note |
|---------|---------|------|
| PERF-01 | **Confirmed** | Single live call site `main.py:266`. Impact = telemetry + overhead, not KPI wrongness. |
| PERF-02 | **Confirmed, widened** | Also applies to snapshot Query B candidate rows, not only inline. |
| PERF-03 | **Potential** (gated by G-1) | Query has no LIMIT; real VIEW row volume not measured. |
| PERF-04 | **Recommendation** | No cache anywhere. |
| ARCH-04 | **Confirmed** | Up to 3 engines per snapshot `/process`; no dispose/timeouts. Low impact on snapshot; high on VIEW. |
| SEC-07 | **Confirmed** | Cap at 500k rows exists; no body/rate limit; `extra="allow"` → A003 S-06. |
| Concurrency model | **Confirmed** | Single process, sync pool; no shared mutable state except tracemalloc. |
| Load testing | **Not executed** | No load-test assets; qualitative only. |

---

## 8. Open questions

| ID | Question | Blocks |
|----|----------|--------|
| **O-1** | Expected concurrent analysts and usage pattern? (assumed ~5–10) | Capacity narrative |
| **O-2** | Latency SLA for `/process`? (assumed interactive, a few seconds) | Queue trigger / P-04 |
| **O-3** | G-1: is VIEW allowed in production? | P-03, P-06, P-12 class |
| **O-4** | Is inline mode needed in production, or can it be disabled? | P-02 / P-05 |
| **O-5** | Host / container CPU–RAM limits and worker count? | P-02, ceiling |
| **O-6** | Refresh schedule vs working hours? | P-11 |

---

## 9. Load test plan (recommended, not executed)

- Small `httpx` script (already a dependency) with threads against Docker snapshot. **No new packages.**
- Cases:
  - `POST /process`, `source=db`, default period, tiers on vs off (P-07);
  - medium / stress inline presets from `synthetic.py` (P-02);
  - 1, 5, 10 concurrent clients;
  - `/health` latency during the run (P-10).
- Record p50/p95, container RSS and CPU.
- **Status: not executed in this audit.**

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Initial REPORT-A007 from SPEC execution (EN). |
