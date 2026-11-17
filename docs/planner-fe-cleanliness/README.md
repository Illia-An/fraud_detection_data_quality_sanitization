# Planner FE Cleanliness (SDD)

Reduce twin duplication and page size in `PlannerPage` and `TtsPlannerPage`
without UX / API / behavior changes. Continues after Shared Planner Shell
(PR #41) and allocator / tier-rename tracks. Origin: architecture review —
FE planner cleanliness.

## Goal

- Extract shared pure helpers and small hooks still duplicated on both pages.
- Keep pages as separate compositions; shell stays layout-only.
- **No user-visible behavior change.**
- Target sizes after the track (aspirational): Planner ≤ ~1000 lines, TTS ≤ ~850.
  Do not chase line count by merging the two pages.

## Out of scope

- Visual redesign, copy changes, i18n key renames (unless required for extract).
- API / OpenAPI / backend changes.
- Merging `plannerScenarioStore` and TTS scenario store.
- Rewriting `handleRun` / slope simulation / unreachable adjust in early stages.
- Splitting `StoreAuditDrawer` (next recommended track after this one).
- Drive-by refactors outside planner FE.

## Naming

| Kind   | Pattern                         | Example |
|--------|---------------------------------|---------|
| Spec   | `SPEC-F###-<slug>.md`           | `SPEC-F001-pure-helpers.md` |
| Report | `reports/REPORT-F###-<slug>.md` | created after the stage |

## Branch

`refactor/fe-planner-cleanliness` (from `main` at `2aa31f8`, after PR #43 /
`v1.38.0-tier-rename`).

## Rules

1. One SPEC -> one commit -> one REPORT. Next stage only after a green REPORT
   and the user says "go".
2. Commit / push / PR only when the user asks.
3. Unrelated working-tree changes (`.env.docker.example`) are never part of
   this track.
4. REPORT records only commands that were actually run.
5. This README index is updated after every stage.
6. Prefer extract of pure helpers / small hooks; keep JSX on the pages until a
   dedicated layout stage (not in this track's early stages).

## Quality gates (every stage, from `web/`)

```powershell
cd web
npx tsc -b
npm run lint
npm run test:run
npx playwright test tests/e2e/planner.spec.ts tests/e2e/tts-planner.spec.ts
```

Note Playwright flakiness if pre-existing; do not weaken asserts without evidence.
Backend / pytest is not required unless shared contracts are touched (they should not be).

## Index

| ID   | Stage | Spec | Report | Status |
|------|-------|------|--------|--------|
| F000 | Baseline (before any code change) | [SPEC](./SPEC-F000-baseline.md) | [REPORT](./reports/REPORT-F000-baseline.md) | DONE |
| F001 | Pure helpers (baseline + CSV) | [SPEC](./SPEC-F001-pure-helpers.md) | [REPORT](./reports/REPORT-F001-pure-helpers.md) | DONE |
| F002 | Goal / horizon draft state hook | [SPEC](./SPEC-F002-goal-drafts.md) | [REPORT](./reports/REPORT-F002-goal-drafts.md) | DONE |
| F003 | Export / save chrome (optional follow-up) | [SPEC](./SPEC-F003-export-chrome.md) | [REPORT](./reports/REPORT-F003-export-chrome.md) | DONE |

## Duplication map (branch start — refined in F000 report)

| Block | PlannerPage | TtsPlannerPage | Candidate extract |
|-------|-------------|----------------|-------------------|
| Reference listing | `availableReferences` | `referencesOf` | `plannerBaseline.ts` |
| Baseline rows at ref | `baselineRowsAtReference` (`five_percent`) | `baselineAt` (`tts`) | same, metric field param |
| Chain mean | `meanChain` | `meanMinutes` | same, value key param |
| CSV download | `downloadPlanCsv` | `downloadTtsPlanCsv` | `plannerCsv.ts` (filename + mapping params) |
| Goal drafts | `targetText`/`horizonText` + `commitGoalDrafts` | inline clamp on Run | F002 hook |
| Excel export flags | `excelExporting` / `excelExportError` | same | F003 if room |

## Metrics (filled by reports)

| Moment | PlannerPage lines | TtsPlannerPage lines | Notes |
|--------|-------------------|----------------------|-------|
| Baseline (F000) | 1406 | 1061 | 378 unit tests; Playwright 2 passed |
| After F001 | 1350 | 1012 | −56 / −49 vs F000; 384 unit tests |
| After F002 | 1327 | 976 | −79 / −85 vs F000; 387 unit tests |
| After F003 | 1316 | 965 | −90 / −96 vs F000; 389 unit tests; track complete |

Line counts = physical lines in file (`Get-Content … | Measure` / `.Count`).
