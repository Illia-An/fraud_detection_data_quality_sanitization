# SPEC-A001 — Architecture: Coupling, Cohesion & Production Viability

| Field | Value |
|-------|--------|
| **ID** | SPEC-A001 |
| **Track** | Production audit (SDD) |
| **Role** | Principal Systems Architect |
| **Status** | Draft |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A001-architecture-coupling.md` (after execution) |
| **Inputs** | Codebase as of branch tip; `docs/assessment/production-readiness-assessment-2026-11-03.ru.md` (ARCH-* as seed, not final verdict) |

---

## 1. Goal

Проанализировать архитектуру текущего MVP и выдать **список архитектурных рисков** с классификацией **блокер релиза / можно отложить**, плюс **минимальный** рефакторинг, достаточный для надёжного запуска **внутри компании** (internal production).

## 2. Role & Focus

**Роль:** Principal Systems Architect.

**Фокус:**
- связность модулей (coupling / cohesion);
- избыточное дублирование логики;
- ранее принятые архитектурные компромиссы и их жизнеспособность при выходе в продакшн;
- устойчивость структуры при росте нагрузки (internal concurrent users / heavier periods — не публичный internet scale).

## 3. Scope

### In scope
- Backend: `backend/`, `src/fraud_guard`, `src/planner`, `src/tts_kitchen`, `api/` (legacy).
- Frontend boundaries that create structural coupling to API/contracts (`web/src/api`, schemas, providers).
- Data-path architecture: VIEW vs snapshot, refresh scripts, dual engines.
- Config / packaging boundaries that affect deploy correctness.
- Load-sensitive structural risks (per-request engines, unbounded payloads, single-process monolith) — as **architecture**, not full perf bench.

### Out of scope
- Auth/PII remediations as security work (owned by later SEC specs); mention only when they are **structural** blockers.
- Full code-quality rewrite, UI redesign, new features.
- Changing business KPI formulas unless required to resolve a release blocker (e.g. source-dependent sanitization semantics).
- Implementing the refactor in this SPEC — execution happens only after SPEC is Approved; results go to REPORT-A001 / follow-up SPECs.

## 4. AI task (execution prompt)

> Проанализируй текущую архитектуру MVP. Выяви места жесткой сцепки (tight coupling), критические уязвимости структуры при росте нагрузки и предложи минимальный рефакторинг, необходимый для надежного запуска внутри компании.

При выполнении:
1. Опираться на код и тесты, не только на assessment.
2. Каждую находку помечать: **Подтверждено** / **Потенциально** / **Рекомендация**.
3. Явно отделить **release blocker** от **defer**.
4. Рефакторинг — минимальный набор изменений; без «идеальной» перестройки.

## 5. Expected artifact

**REPORT-A001** must contain:

1. **Краткая карта компонентов** (1 диаграмма/список границ модулей).
2. **Реестр архитектурных рисков** — таблица:

| ID | Finding | Coupling / cohesion / compromise / load | Evidence | Class | Severity | Effort | Minimal fix |
|----|---------|------------------------------------------|----------|-------|----------|--------|-------------|
| A-… | … | … | path/test | **Release blocker** \| **Defer** | C/H/M/L | S/M/L | … |

3. **Минимальный рефакторинг для internal launch** — упорядоченный backlog (только то, без чего нельзя честно запускать).
4. **Что сознательно откладываем** — с обоснованием «почему безопасно отложить внутри компании».
5. **Открытые решения бизнеса** (если семантика KPI/источника неоднозначна).

Seed IDs from assessment (re-verify, do not copy blindly): ARCH-01 … ARCH-09 and related PERF/DATA structural items.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Ломает корректность KPI, целостность деплоя, или создаёт структурный отказ при ожидаемой внутренней нагрузке. Без фикса internal launch не считается надёжным. |
| **Defer** | Техдолг / smell / nice-to-have; не блокирует internal launch при известных ограничениях (документировать ограничение). |

Severity / Effort: как в assessment (Critical/High/Medium/Low; S/M/L/XL).

## 7. Acceptance criteria

- [ ] REPORT-A001 создан по пути выше.
- [ ] Каждый blocker имеет evidence (файл/тест/поведение) и минимальный fix.
- [ ] Coupling/duplication/compromises покрыты явно (не только security).
- [ ] Assessment ARCH-* перепроверены: confirmed / narrowed / rejected.
- [ ] Backlog минимального рефакторинга ≤ того, что нужно для internal launch (нет scope creep).
- [ ] README index обновлён: A001 → Spec + Report + status.

## 8. Non-goals for this SPEC’s report

- Не писать полный production runbook.
- Не править код в рамках одной только спеки (код — отдельный SDD-цикл после Approve, если решим).
- Не дублировать SEC/DATA спеки; только архитектурный угол.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #1 (Architect & Design). |
