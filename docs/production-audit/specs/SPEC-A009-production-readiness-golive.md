# SPEC-A009 — Production Readiness: Graceful Shutdown, Probes & Go-Live

| Field | Value |
|-------|--------|
| **ID** | SPEC-A009 |
| **Track** | Production audit (SDD) |
| **Role** | Operations & Release Manager |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A009-production-readiness-golive.md` (after execution) |
| **Inputs** | `backend/main.py`, Dockerfile HEALTHCHECK, compose/restart; assessment OBS-03, DATA-04, ARCH-04, INFRA-*; SPEC-A002…A006 (aggregate gates) |

---

## 1. Goal

Проверить эксплуатационную готовность к internal Go-Live:
- умеет ли приложение **корректно завершать работу** (Graceful Shutdown) без обрыва активных запросов там, где это ожидаемо;
- как оркестратор/compose понимает **liveness vs readiness**;
- готова ли система к **бесшовному переключению** (deploy/switch: image + snapshot data path).

Итог: **Go-Live Checklist** с явным Pass / Fail / Waive по каждому пункту.

## 2. Role & Focus

**Роль:** Operations & Release Manager.

**Фокус:**
- Graceful Shutdown (SIGTERM, in-flight requests, engine dispose);
- Health checks: liveness vs readiness probes;
- бесшовные «миграции» данных в смысле продукта (atomic snapshot swap / schema_version — не OLTP migrations);
- общая operational readiness перед включением трафика.

## 3. Scope

### In scope
- Process lifecycle: uvicorn SIGTERM behavior; FastAPI lifespan (есть/нет); engine cleanup.
- Probes: `/health` today; need for `/ready` (snapshot present, age, schema); Docker `HEALTHCHECK` wiring; compose `depends_on` / restart.
- Cutover readiness: can traffic move to new revision without serving half-written snapshot or cold-fail loops.
- In-flight long requests (`/process`, VIEW SQL): drain behavior and timeout interaction.
- Go-Live gate aggregation: minimum blockers from A002–A006/A003 that must be green or waived.
- Rollback linkage (A006) as go-live prerequisite.

### Out of scope
- Designing full CD platform (A006 owns pipeline detail) — here: ops acceptance of cutover.
- Deep security auth design (A003) — only “must have / waive for internal LAN” as checklist rows.
- Load testing (A007).
- Implementing lifespan/ready in this SPEC — report + checklist until Approved.

### Reality check
Оркестратор сегодня = **Docker Compose / single host**, не Kubernetes. «Бесшовное переключение» = смена image tag + atomic data file + probes, не blue/green mesh. Сказать as-is vs target явно.

## 4. AI task (execution prompt)

> Проверь, умеет ли приложение корректно завершать работу (Graceful Shutdown) и как оркестратор понимает, что сервис жив и готов принимать трафик (Health Checks). Готова ли система к бесшовному переключению?

При выполнении:
1. Evidence for shutdown path (default uvicorn vs custom lifespan).
2. Distinguish **liveness** (process up) vs **readiness** (safe to send traffic / data OK).
3. Answer seamless cutover: **Yes / Partial / No** + gaps.
4. Produce Go-Live Checklist; class gaps **Release blocker** | **Defer** / Waive with owner.
5. Findings **Подтверждено** / **Потенциально** / **Рекомендация**.

## 5. Expected artifact

**REPORT-A009** must contain:

1. **As-is ops posture** — shutdown, probes, cutover.
2. **Answers** to the three questions (shutdown / probes / seamless switch).
3. **Go-Live Checklist** (главный артефакт):

| # | Gate | Category | Required evidence | Status (Pass/Fail/Waive) | Owner | Blocker? |
|---|------|----------|-------------------|--------------------------|-------|----------|

   Categories at minimum: Shutdown & lifecycle, Liveness, Readiness/data, Secrets & access, Deploy & rollback, Observability min, Smoke tests, Data backup, Config freeze.
4. **Cutover runbook sketch** (pre → drain/stop → start → ready → smoke → declare live).
5. **Blockers vs waivers** for internal launch.
6. Cross-ref open items from A002–A006 that feed the checklist.

Seed: OBS-03, DATA-04, ARCH-04 lifespan, INFRA-02/05, assessment note on uvicorn SIGTERM.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Orchestrator cannot tell ready vs alive; cutover can serve corrupt/missing data; shutdown leaves undefined state; no rollback path signed off. |
| **Defer** | K8s-native probes, zero-downtime multi-instance; polish after single-host go-live with documented maintenance window. |

## 7. Acceptance criteria

- [x] REPORT-A009 создан; три вопроса AI task отвечены явно.
- [x] Go-Live Checklist полный для internal launch.
- [x] Seamless cutover verdict + gaps; README index A009 updated.

## 8. Non-goals

- Не заменять A005 (logging spec) или A006 (full DR) — только go-live gates.
- Не проводить реальный production cutover из аудита.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #9 (Production Readiness / Go-Live). |
| 2026-11-04 | Executed → REPORT-A009 (EN); status Report ready. |
