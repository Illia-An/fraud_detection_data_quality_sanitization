# SPEC-A007 — Performance & Scalability: Bottlenecks, Cache, Queues

| Field | Value |
|-------|--------|
| **ID** | SPEC-A007 |
| **Track** | Production audit (SDD) |
| **Role** | Performance Architect |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A007-performance-scalability.md` (after execution) |
| **Inputs** | Codebase (sync API paths, profiler, engines, Query B); assessment PERF-*, ARCH-04, SEC-07; SPEC-A001/A002/A005 (cross-links); assumed internal concurrent users (state assumption if unknown) |

---

## 1. Goal

Найти, **где система упрётся в потолок** при одновременном доступе внутренних пользователей; решить, нужна ли **очередь задач** (Celery/RQ/и т.п.) для тяжёлых операций вместо синхронного выполнения на первом релизе.

Итог: **отчёт об узких местах** + **рекомендации по кэшированию/очередям**, с blocker vs defer для internal launch.

## 2. Role & Focus

**Роль:** Performance Architect.

**Фокус:**
- bottlenecks (CPU, memory, DB/IO, GIL/thread pool, connection churn);
- caching strategy (when deterministic / safe);
- concurrency model (uvicorn workers, sync handlers, shared mutable state);
- background workers/queues — need vs defer;
- capacity estimate for first internal release (qualitative if no load test).

## 3. Scope

### In scope
- Hot paths: `/api/v1/process` (inline + db/pushdown), planners, TTS KPI/kitchen reads.
- `backend/profiler.py` / `tracemalloc` under concurrency (PERF-01).
- Engine-per-request / missing timeouts (ARCH-04).
- Unbounded / large payloads (SEC-07, PERF-02/03).
- Snapshot-read caching opportunity (PERF-04).
- Concurrency model: single process, sync routes, thread pool; shared state risks.
- Queue decision: which ops (if any) must leave request thread for v1.
- Qualitative ceiling: “N concurrent analysts” assumptions + first failure mode.

### Out of scope
- Full load-test campaign / k6 suite execution unless already available (recommend plan; mark if not run).
- Introducing Redis/Celery in this SPEC — recommend yes/no + trigger conditions.
- Horizontal scale / multi-region.
- Changing KPI algorithms for speed unless required for safe launch.

## 4. AI task (execution prompt)

> Где система упрется в потолок при одновременном обращении внутренних пользователей? Нужна ли очередь задач (например, Celery/Redis Queue) для тяжелых операций вместо синхронного выполнения?

При выполнении:
1. Map request lifecycle and resource contention points with evidence.
2. Answer ceiling question: first bottleneck under internal concurrency.
3. Answer queue question explicitly: **Need for v1 / Not needed if … / Defer until …**.
4. Cache recommendations with invalidation key (e.g. `loaded_at`).
5. Class **Release blocker** | **Defer**; findings **Подтверждено** / **Потенциально** / **Рекомендация**.

## 5. Expected artifact

**REPORT-A007** must contain:

1. **Concurrency & runtime model** (as-is).
2. **Bottleneck registry**:

| ID | Bottleneck | Resource | Trigger | Evidence | Class | Severity | Effort | Mitigation |
|----|------------|----------|---------|----------|-------|----------|--------|------------|

3. **Ceiling narrative** — where it hits first for internal users (no vanity scale claims).
4. **Caching recommendations** — what/when/key/ttl-or-invalidate; what not to cache.
5. **Queue / background workers verdict** (главный ответ) + which endpoints would move if ever.
6. **Minimal pre-release perf actions** vs defer.
7. Re-verify PERF-01 … PERF-04; related ARCH-04, SEC-07.
8. **Open questions** (expected concurrent users, SLA latency, VIEW in prod).

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Under expected internal concurrency, likely process hang/OOM/wrong shared-state; unbounded heavy sync path without guardrails; no timeouts on live SQL path if that path is production. |
| **Defer** | Optional result cache; workers/queues without proven need; multi-worker tuning; load-test luxury after smoke capacity check. |

## 7. Acceptance criteria

- [x] REPORT-A007 создан; вопросы про потолок и очереди отвечены явно.
- [x] Bottlenecks + cache/queue recommendations присутствуют.
- [x] PERF-* перепроверены; README index A007 updated.

## 8. Non-goals

- Не внедрять Redis/Celery «на всякий случай».
- Не подменять A001 architecture или A002 index plan — только perf angle.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #7 (Performance & Scalability). |
| 2026-11-04 | Executed → REPORT-A007 (EN); status Report ready. |
