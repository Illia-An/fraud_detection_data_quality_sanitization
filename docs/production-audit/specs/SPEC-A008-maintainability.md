# SPEC-A008 — Maintainability: Tech Debt, Smells & 6-Month Supportability

| Field | Value |
|-------|--------|
| **ID** | SPEC-A008 |
| **Track** | Production audit (SDD) |
| **Role** | Tech Lead & Code Reviewer |
| **Status** | Report ready |
| **Branch** | `audit/production-readiness` |
| **Report** | `docs/production-audit/reports/REPORT-A008-maintainability.md` (after execution) |
| **Inputs** | Codebase structure & key large modules; assessment CODE-*, ARCH-05/07/08; SPEC-A001 (architecture overlap — maintainability angle only) |

---

## 1. Goal

Провести ревью кодовой базы на **технический долг**: code smells, сложность, дублирование, типизация, документация; оценить, **насколько легко поддерживать и развивать проект через ~6 месяцев**.

Явно ответить: какие модули написаны «на честном слове» и потребуют **срочного переписывания / выделения** при первом изменении требований.

Итог: **бэклог техдолга с оценкой рисков поддержки** (blocker vs defer для *maintainability of release*, не путать с security blockers).

## 2. Role & Focus

**Роль:** Tech Lead & Code Reviewer.

**Фокус:**
- code smells и god-modules;
- duplication (DRY breaks that multiply change cost);
- typing quality (Python + TypeScript);
- docs/comments drift vs behavior;
- change-impact risk: “first requirement change breaks two copies”.

## 3. Scope

### In scope
- Domain vs HTTP boundaries: `src/fraud_guard`, `src/planner`, `src/tts_kitchen`, `backend/service.py`, `backend/main.py`.
- Known twins: five_percent vs tts planners (backend + `PlannerPage` / `TtsPlannerPage`); snapshot modules pair.
- Large multi-responsibility modules (CODE-02 seed: size/ownership).
- Typing/lint posture: ruff/mypy absence, `# type: ignore`, Zod/Pydantic contract drift risk.
- Naming drift (ARCH-05 tiers), packaging drift (ARCH-07), legacy `api/` (ARCH-08) as maintainability cost.
- Docs: SPEC.md / root SPECs vs code; misleading docstrings (e.g. PII hash once).
- “Fragile under change” list — modules that must be rewritten/extracted before feature work.

### Out of scope
- Full rewrite proposals for healthy pure domain cores.
- Security/PII remediations (A003) except where debt increases change risk.
- Implementing refactors in this SPEC — backlog only until Approved.
- Style-only nits without support risk.

## 4. AI task (execution prompt)

> Проведи ревью кодовой базы на предмет технического долга. Какие модули написаны "на честном слове" и потребуют срочного переписывания при первом же изменении требований?

При выполнении:
1. Inventory smells / duplication / complexity hotspots with evidence (paths, size, twin diffs at high level).
2. Answer “честное слово” list explicitly — rewrite/extract urgency **before** feature change vs can live.
3. Rate 6-month supportability (qualitative score + rationale).
4. Class **Release blocker** (only if debt blocks safe change/ops of released system) | **Defer** (normal backlog).
5. Findings **Подтверждено** / **Потенциально** / **Рекомендация**.

## 5. Expected artifact

**REPORT-A008** must contain:

1. **Supportability summary** (6-month outlook).
2. **“Fragile / rewrite-soon” modules** — ranked, with why first requirement change is expensive.
3. **Tech debt backlog** (главный артефакт):

| ID | Item | Smell type | Evidence | Support risk (6mo) | Class | Severity | Effort | Suggested next step |
|----|------|------------|----------|--------------------|-------|----------|--------|---------------------|

4. **Typing & static analysis gaps**.
5. **Docs drift** list.
6. Re-verify CODE-01 … CODE-05; related ARCH-05/07/08.
7. What **not** to rewrite (preserve good seams).

## 6. Classification rules

| Class | Meaning |
|-------|---------|
| **Release blocker** | Debt that makes a required release change unsafe/untestable, or dual-path drift already causing incorrect behavior under likely config. Rare for pure style debt. |
| **Defer** | Duplication/size that raises cost but system is correct and tested; extract after launch behind tests. |

## 7. Acceptance criteria

- [x] REPORT-A008 создан; вопрос про «честное слово» модули отвечен списком.
- [x] Tech debt backlog with support-risk ratings присутствует.
- [x] CODE-* перепроверены; README index A008 updated.

## 8. Non-goals

- Не смешивать с полным architecture redesign (A001) — здесь cost-of-change и smells.
- Не массовый reformat.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Draft from audit brief #8 (Maintainability). |
| 2026-11-04 | Executed → REPORT-A008 (EN); status Report ready. |
