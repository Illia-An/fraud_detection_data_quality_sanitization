# SPEC-A004 — Testing & Quality: Core Journeys, Smoke & Regression

| Field | Value |
|-------|--------|
| **ID** | SPEC-A004 |
| **Track** | Production audit (SDD) |
| **Role** | QA Lead & Automation Engineer |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A004-testing-quality.md` (after execution) |
| **Inputs** | Codebase + CI (`.github/workflows/ci.yml`); assessment TEST-*; existing suites (`tests/`, `web/**/*.test.*`, `web/tests/e2e/`); SPEC-A001…A003 for risk-driven coverage gaps |

---

## 1. Goal

Определить **Core User Journeys**, которые обязаны быть покрыты автотестами (или минимум интеграционными) перед internal release; выявить сценарии, которые чаще всего валят систему; зафиксировать **план приёмочного тестирования (Smoke & Regression Test Suite)** с gaps и приоритетами.

## 2. Role & Focus

**Роль:** QA Lead & Automation Engineer.

**Фокус:**
- Happy Path и Negative Path критических пользовательских сценариев;
- структура и стабильность тестов (flaky risk);
- достаточность покрытия ключевой бизнес-логики (KPI sanitization, planners, data-path);
- что должно войти в smoke vs full regression до релиза.

## 3. Scope

### In scope
- Backend: `tests/` (pytest) — domain, API contracts, query/pushdown parity, snapshot, TTS/kitchen.
- Frontend: Vitest unit/component tests under `web/src/`.
- E2E: Playwright `web/tests/e2e/` (`sanitization.spec.ts`, `planner.spec.ts`, …).
- CI gates: what runs today vs what is missing for production confidence.
- Failure modes tied to product paths: bad payload, empty period, VIEW vs snapshot semantics, mid-month window, planner bounds, health/readiness, SPA static edge cases.
- Flaky signals: timing, network mocks, TestClient deprecation, env-dependent DB tests.

### Out of scope
- Implementing the full new suite in this SPEC (report + plan only until Approved).
- Load/perf benchmarking (note as separate if critical).
- Manual UAT script for business sign-off beyond smoke checklist (can list owners).
- Security exploit tests as attack scripts (coordinate with A003; security regression cases OK as expected status codes / containment).

## 4. AI task (execution prompt)

> Определи критические пути пользователя (Core User Journeys), которые обязательно должны быть покрыты автоматическими или хотя бы интеграционными тестами перед релизом. Какие сценарии чаще всего приводят к падению системы?

При выполнении:
1. Inventory current coverage by layer (unit / API / e2e / CI).
2. Map Core User Journeys → existing tests → **Covered / Partial / Gap**.
3. List high-crash / high-cost failure scenarios (from code risks + assessment), Happy + Negative.
4. Propose Smoke (pre-deploy / post-deploy) vs Regression (CI) suites.
5. Flag flaky / brittle areas; class **Release blocker** | **Defer** for missing coverage.

## 5. Expected artifact

**REPORT-A004** must contain:

1. **Core User Journeys** (numbered), each with Happy / Negative variants.
2. **Coverage map**: Journey × Layer × Status × Evidence (test path).
3. **Failure-prone scenarios** — что чаще валит систему / даёт wrong KPI (link ARCH/DATA/SEC where relevant).
4. **Smoke & Regression Test Suite plan** (главный артефакт):

| Suite | When | Cases (IDs) | Pass criteria | Owner |
|-------|------|-------------|---------------|-------|

5. **Gap backlog** before release (must-add tests) vs defer.
6. **Flaky / stability notes** and CI recommendations (coverage thresholds optional).
7. Re-verify TEST-01 … TEST-03.

Suggested journey seeds (confirm/adjust from product):
- Sanitization synthetic happy path → KPI cards.
- Sanitization `source=db` / snapshot path (if production path).
- Five-percent planner: baseline → allocate → inspect.
- TTS planner equivalent.
- TTS kitchen before/after (or explicit “coming soon” gate).
- Health / app boot / static SPA.
- Negative: invalid config, empty data, oversized payload, unauthorized (post-auth), path traversal static.

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Core journey without automated or documented integration coverage; known wrong-KPI / crash path without regression test; smoke cannot prove deploy health. |
| **Defer** | Coverage metrics polish; secondary UI; journeys behind feature flags / coming-soon; nice-to-have negative cases with low likelihood. |

## 7. Acceptance criteria

- [ ] REPORT-A004 создан с Core Journeys + coverage map.
- [ ] Smoke & Regression plan с конкретными case IDs и pass criteria.
- [ ] Gaps до релиза явно marked blocker/defer.
- [ ] Assessment TEST-* перепроверены.
- [ ] README index: A004 → Spec + Report + status.

## 8. Non-goals

- Не гнать полный Playwright в отчёте обязательно, если среда недоступна — опираться на код спеков + CI config; отметить «not executed in audit run».
- Не расширять продукт новыми фичами ради тестируемости без отдельного Approve.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #4 (Testing & Quality). |
