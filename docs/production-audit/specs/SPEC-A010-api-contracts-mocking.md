# SPEC-A010 — API Contracts & Mocking: Decouple UI from Snapshots & Sources

| Field | Value |
|-------|--------|
| **ID** | SPEC-A010 |
| **Track** | Production audit (SDD) |
| **Role** | API / Frontend Integration Architect (contract discipline) |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A010-api-contracts-mocking.md` (after execution) |
| **Inputs** | `web/src/api/*`, `web/src/schemas/*`, FastAPI OpenAPI (`/openapi.json`, `/docs`), Pydantic schemas; assessment contract notes; SPEC-A001/A004 |

---

## 1. Goal

Исключить **жёсткую связанность** UI/бизнес-логики с временными снапшотами и конкретным transport; обеспечить **плавный переход** между synthetic → snapshot → live API/source **без переписывания** доменной логики экранов.

Итог: заполненный **чек-лист контрактов/моков/абстракции** + gaps (blocker vs defer) для internal production.

## 2. Role & Focus

**Фокус (из брифа):**
- API-First / contract-first discipline;
- слой абстракции данных (API client / repository);
- mocking (latency, 4xx/5xx);
- изоляция снапшотов/конфига точки входа (Base URL / adapter).

## 3. Scope

### In scope
- **Contract source of truth:** FastAPI OpenAPI vs hand-maintained Zod (`web/src/schemas`); drift risk; whether OpenAPI was/is primary before FE work (historical + current practice).
- **API client layer:** `web/src/api/client.ts`, `config.ts`, `hooks.ts` — do pages/components call `fetch` directly?
- **Backend contract tests:** `tests/test_*_api.py`, OpenAPI response model asserts.
- **Mocking:** Vitest mocks, Playwright fixtures, MSW (present/absent), synthetic presets `/sample/{preset}`, latency/error simulation.
- **Snapshot / source isolation:** how `source=db` / snapshot paths and env Base URL switch; whether UI business logic depends on snapshot shape vs API DTO.
- **Adapter seam:** what must change to point at another backend host or drop inline rows — ideally Base URL + adapter only.

### Out of scope
- Rewriting FE to OpenAPI codegen in this SPEC (recommend only).
- Designing new public API versioning strategy beyond what’s needed for internal launch.
- Deep security of endpoints (A003).
- Implementing mocks/MSW until Approved.

### Reality check (must state in report)
Продукт **уже** с FastAPI + React; «до появления бэкенда» трактовать как: дисциплина контракта при развитии фич + изоляция от SQLite snapshot / VIEW / synthetic как **источников за адаптером**, не как «бэкенда ещё нет».

## 4. AI task (execution prompt)

Проверить по чек-листу брифа и ответить evidence-based:

1. Зафиксирована ли спецификация эндпоинтов (OpenAPI/Swagger или JSON-схемы) **как первичный контракт** (сейчас и/или исторически)?
2. Вся ли логика запросов в изолированных модулях (нет прямого `fetch`/БД из компонентов)?
3. Есть ли заглушки с latency и 4xx/5xx?
4. Отделены ли статические витрины/JSON/snapshot от кода так, что смена бэкенда = Base URL / Adapter?

Class gaps **Release blocker** | **Defer**.

## 5. Expected artifact

**REPORT-A010** must contain:

1. **Checklist results** (главный артефакт) — четыре пункта брифа: Pass / Partial / Fail + evidence.
2. **Contract map:** endpoint → Pydantic → Zod → consumer hook/page.
3. **Coupling hotspots:** places that break if snapshot/source changes.
4. **Mocking strategy as-is vs recommended** (unit / e2e / local FE-without-backend).
5. **Minimal remediation backlog** for smooth source/API switch.
6. Open questions (codegen? MSW? single OpenAPI export in CI?).

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | UI business logic hard-wired to snapshot files or ad-hoc JSON shapes; switching Base URL/source requires rewriting screens; no validated response contracts on critical paths. |
| **Defer** | OpenAPI codegen, MSW polish, latency simulation niceties; dual Zod/Pydantic maintained manually if parity tests exist. |

## 7. Acceptance criteria

- [x] REPORT-A010 создан; все 4 checklist items answered with evidence.
- [x] Coupling vs adapter seams documented.
- [x] README index A010 updated.

## 8. Non-goals

- Не подменять A001 (architecture) — только contract/FE data access angle.
- Не требовать удаления synthetic presets (они валидный adapter path).

---

## Checklist (copy into report)

- [x] **API-First:** Partial — Pydantic is source of truth; OpenAPI is generated; Zod is hand-maintained.
- [x] **API Client / Repository:** Pass — `fetch` only in `web/src/api/client.ts`.
- [x] **Mocking:** Fail — no MSW, no latency/4xx harness (Defer).
- [x] **Snapshot isolation:** Partial — Base URL + `usePipelineRunner` adapter; a few duplicated constants remain.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #10 (API Contracts & Mocking). |
| 2026-11-04 | Executed → REPORT-A010 (EN); status Report ready. |
