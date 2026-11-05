# SPEC-A012 — Integration & Transition Readiness: Snapshot → Live Data Cutover

| Field | Value |
|-------|--------|
| **ID** | SPEC-A012 |
| **Track** | Production audit (SDD) |
| **Role** | Integration / Data Transition Lead |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A012-integration-transition-cutover.md` (after execution) |
| **Inputs** | Zod/Pydantic validation paths; `SANITIZATION_SOURCE`; refresh scripts; assessment ARCH-01, DATA-*, INFRA-01; SPEC-A002/A009/A010 |

---

## 1. Goal

Обеспечить **безопасный перенос** со стадий витрин/synthetic/snapshot на **реальные источники** и prod-окружение без сюрпризов по KPI и без падения UI.

Итог: проверка **валидации схем** + **пошаговый Cutover Plan** (blocker vs defer).

## 2. Focus (brief + extensions)

**Из брифа:**
- валидация входящих схем (Pydantic / Zod);
- описанный Cutover Plan (mock/витрины → боевое API).

**Дополнения для этого репо:**
- multi-hop transition: **synthetic → snapshot → view/live** (и отдельно TTS KPI / kitchen);
- business gate: одинаковый ли смысл «sanitized 5%» на целевом источнике (ARCH-01);
- pre-cutover: validated refresh, row-count thresholds, `loaded_at` / readiness;
- post-cutover: smoke journeys (A004), cache clear, config flip, rollback source/file;
- connectivity checklist (ODBC/DreamFactory only if that path is chosen).

## 3. Scope

### In scope
- FE: `web/src/api/client.ts` Zod parse on responses; error UX on schema fail.
- BE: Pydantic request/response models; OpenAPI.
- Data sources: inline synthetic, Q10012 snapshot, VIEW mode, TTS snapshot/SQL/DF, kitchen MSSQL.
- Env/config switches that constitute “going live on real data”.
- Cutover plan document requirements (steps, owners, abort criteria).
- Parity checks: golden synthetic vs snapshot sample; known VIEW tier limitations.

### Out of scope
- Implementing physical tables / DBA warehouse (SPEC §5.4) — note as long-term option.
- Full A003 security go-live (reference as dependency if VIEW opens SQL from container).
- Executing production cutover in this SPEC — plan + readiness score only.

## 4. AI task (execution prompt)

1. Проверяются ли данные из API валидаторами так, что изменения схемы не роняют UI молча?
2. Описан ли (или должен быть описан) пошаговый план перехода с мок/витрин/snapshot на боевые данные — включая конфиг, кэш, связность, проверку KPI?

Class gaps **Release blocker** | **Defer**.

## 5. Expected artifact

**REPORT-A012** must contain:

1. **Checklist** (2 brief items + extensions): Pass / Partial / Fail + evidence.
2. **Validation coverage map** — which endpoints/schemas validated where; gaps.
3. **Source transition matrix** — current default vs target prod path per feature.
4. **Cutover Plan** (главный артефакт) — step table:

| Step | Action | Config / command | Verify | Abort if |
|------|--------|------------------|--------|----------|

5. **Parity / semantics gates** (ARCH-01 and friends).
6. **Rollback cutover** procedure.
7. Open questions (G-1 source of truth, G-3 connectivity, freshness SLA).

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | No response validation on critical UI paths; no written cutover/rollback; prod would flip source with silent tier/KPI change or unvalidated empty snapshot. |
| **Defer** | VIEW-in-container ODBC; physical tables; advanced dual-run shadow traffic — after snapshot-based internal launch if that is chosen path. |

## 7. Acceptance criteria

- [x] REPORT-A012 создан; brief checklist answered.
- [x] Cutover Plan with verify/abort present.
- [x] README index A012 updated.

## 8. Non-goals

- Не подменять A009 Go-Live (app probes) — здесь **data/source transition**.
- Не подменять A010 contracts — здесь **readiness to flip sources**.

---

## Checklist (copy into report)

- [x] **Data validation** — Partial. Zod/Pydantic on the critical path; `meta` does not catch a source-mode change.
- [x] **Cutover Plan** — Fail as a signed runbook. Draft with verify/abort is in REPORT-A012 §4.
- [x] *(ext)* **Target source decided** — Fail. G-1 open.
- [x] *(ext)* **KPI/tier semantics gate** — Fail. A001 A-01; UI does not read `query_b_mode`.
- [x] *(ext)* **Refresh validated + atomic** — Fail. A002 D-01/D-04.
- [x] *(ext)* **Cutover rollback** — Fail as a procedure. Steps in REPORT-A012 §5.
- [x] *(ext)* **Post-cutover smoke** — Fail. SM-13/SM-14 described, not a required promote step.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #12 (+ snapshot→live extensions). |
| 2026-11-05 | Executed → REPORT-A012 (EN); status Report ready. |
