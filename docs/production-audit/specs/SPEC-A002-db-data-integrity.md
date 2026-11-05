# SPEC-A002 — DB & Data Integrity: Schema, Refresh Safety, Query Hotspots

| Field | Value |
|-------|--------|
| **ID** | SPEC-A002 |
| **Track** | Production audit (SDD) |
| **Role** | Senior Database Administrator & Data Engineer |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A002-db-data-integrity.md` (after execution) |
| **Inputs** | Codebase as of branch tip; `docs/assessment/production-readiness-assessment-2026-11-03.ru.md` (DATA-*, related PERF/INFRA as seed); SPEC-A001 (boundaries only) |

---

## 1. Goal

Проверить схемы, индексы и логику работы с БД/снимками; найти узкие места по производительности (N+1, отсутствие индексов под реальные фильтры/join-пути, full scans на больших периодах) и **риски потери/порчи данных при сбое во время refresh/записи**.

Итог: **план оптимизации индексов** + **список критических «миграций»/изменений схемы и refresh-процедур до релиза** (internal production), с классификацией **блокер / отложить**.

## 2. Role & Focus

**Роль:** Senior Database Administrator & Data Engineer.

**Фокус:**
- схемы таблиц (SQL Server источники + SQLite snapshots);
- безопасность «миграций» / эволюции схемы snapshot;
- транзакционность критических процессов записи (refresh in-place vs atomic swap);
- constraints / FK / целостность (где применимо; где by design отсутствуют — явно зафиксировать);
- неоптимальные паттерны запросов, включая N+1;
- свежесть данных и детект битых/неполных снимков.

## 3. Scope

### In scope
- SQLite: `backend/snapshot.py`, `backend/tts_kpi_snapshot.py` (schema, indexes, meta).
- Refresh: `scripts/refresh_q10012_snapshot.py`, `scripts/refresh_tts_kpi_snapshot.py` (atomic vs in-place, validation, rollback).
- Read path: `backend/queries.py`, `backend/db_sample.py`, `backend/tts_kitchen_queries.py`, `backend/tts_kpi_ap.py`, `db/connection.py`.
- SQL Server / DreamFactory read-only access patterns (parameterization, timeouts, identifier qualification) — integrity & perf angle.
- Snapshot meta: `loaded_at`, row counts, **schema_version** (наличие/отсутствие).
- Backup/restore posture for snapshot files (integrity of the only writable store).

### Out of scope
- Auth / PII hashing policy as security remediations (SEC specs); note data-at-rest exposure only if it affects integrity/ops of refresh.
- Full architecture refactor (SPEC-A001).
- Application feature DB for plans/runs persistence (DATA-05) — classify only, do not design product scope.
- Live load tests against production SQL Server (optional timing notes if safe/local; no production writes).
- Implementing fixes in this SPEC — report only until Approved.

### Reality check (must state in report)
Проект **не** использует классические app-migrations. «Критические миграции до релиза» = изменения schema/meta/refresh/index, без которых internal launch рискован (порча снимка, silent schema drift, неверные KPI из-за окна/источника).

## 4. AI task (execution prompt)

> Проверь схемы таблиц, индексы и логику работы с БД. Найди потенциальные узкие места по производительности (N+1 запросы, отсутствие индексов на foreign keys) и риски потери данных при сбое во время транзакций.

При выполнении:
1. Код + assessment seed; каждую находку: **Подтверждено** / **Потенциально** / **Рекомендация**.
2. Явно проверить: N+1 (подтвердить или опровергнуть assessment «не найдено»), индексы vs Query A/B / TTS / kitchen, refresh crash mid-write.
3. FK/constraints: где их нет — объяснить (denormalized snapshot vs OLTP) и нужен ли surrogate integrity check.
4. Класс: **Release blocker** | **Defer**.

## 5. Expected artifact

**REPORT-A002** must contain:

1. **Инвентарь хранилищ** — что read-only, что writable; кто пишет.
2. **Схемы и индексы** — текущее состояние + gaps vs query patterns.
3. **Реестр data-рисков**:

| ID | Finding | Theme (schema / txn / constraint / query / freshness) | Evidence | Class | Severity | Effort | Action before release |
|----|---------|--------------------------------------------------------|----------|-------|----------|--------|------------------------|

4. **План оптимизации индексов** — приоритетный список (что добавить/изменить, на каком store, зачем, риск).
5. **Критические миграции / refresh changes до релиза** — упорядоченный checklist (schema_version, atomic refresh, validation gates, backup, …).
6. **Defer list** с обоснованием.
7. **Открытые вопросы** (напр. SLA свежести снимка, допустим ли VIEW path в prod).

Seed (re-verify): DATA-01 … DATA-05, PERF related to DB, INFRA-01/05, ARCH-02/04 where data-path.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Риск silent corruption / partial snapshot serving / schema mismatch crash / systemic wrong aggregates from query/index/window bugs; нет безопасного refresh/rollback. |
| **Defer** | Perf nice-to-have без доказанного bottleneck; отсутствие app-DB persistence by design; index tweaks без evidence. |

## 7. Acceptance criteria

- [ ] REPORT-A002 создан по пути выше.
- [ ] N+1 явно подтверждён или опровергнут с evidence.
- [ ] Refresh path разобран на crash scenarios (mid-delete / mid-insert / meta write).
- [ ] Index plan и pre-release migration/refresh checklist присутствуют.
- [ ] Каждый blocker имеет конкретное действие до релиза.
- [ ] README index: A002 → Spec + Report + status.

## 8. Non-goals for this SPEC’s report

- Не внедрять индексы/скрипты в код (отдельный цикл после Approve).
- Не дублировать полный SEC audit.
- Не проектировать новый warehouse / CDC.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #2 (DB & Data Integrity). |
