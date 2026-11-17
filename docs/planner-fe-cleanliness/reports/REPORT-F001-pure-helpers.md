# REPORT-F001 - Pure helpers (baseline + CSV)

| Field | Value |
|-------|-------|
| Spec | [SPEC-F001-pure-helpers.md](../SPEC-F001-pure-helpers.md) |
| Result | GREEN (unit/tsc/lint; Playwright TTS note below) |
| Previous | [REPORT-F000](./REPORT-F000-baseline.md) |

## What changed

| File | Change |
|------|--------|
| `web/src/components/planner/plannerBaseline.ts` | new: `availablePeriodReferences`, `baselineRowsAtReference`, `equalWeightMean`, `equalWeightMeanBy` |
| `web/src/components/planner/plannerBaseline.test.ts` | new (3 tests) |
| `web/src/components/planner/plannerCsv.ts` | new: `buildPlanProjectionCsvLines`, `downloadTextFile`, `downloadPlanProjectionCsv` |
| `web/src/components/planner/plannerCsv.test.ts` | new (3 tests) |
| `web/src/pages/PlannerPage.tsx` | removed local helpers; imports shared modules |
| `web/src/pages/TtsPlannerPage.tsx` | same (local `clampTarget` / `clampHorizon` kept for F002) |

CSV chain row now maps `chain_trajectory` scores directly (Planner previously
re-`find`’d the same array — identical output). Filenames unchanged:
`plan_five_percent_projections.csv` / `plan_tts_projections.csv`.

## Line counts

| File | F000 | F001 | Δ |
|------|------|------|---|
| PlannerPage.tsx | 1406 | **1350** | −56 |
| TtsPlannerPage.tsx | 1061 | **1012** | −49 |

Local duplicates of extracted functions: none
(`rg` over `src/pages` for old helper names — no matches).

## Checks (from `web/`, actually run)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | exit 0 |
| Lint (source) | `npx eslint src tests --max-warnings 0` | exit 0 |
| New unit | vitest `plannerBaseline` + `plannerCsv` | 6 passed |
| Full unit | `npm run test:run` | **86 files / 384 tests** (378 + 6), exit 0 |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` (as part of pair run) | **passed** |
| Playwright tts | `tests/e2e/tts-planner.spec.ts` | **failed** (see below); re-run also failed |

### Playwright TTS note (pre-existing flake, not fixed)

Failure is Playwright **strict mode** on:

```ts
getByTestId('tts-allocation-levers')
  .or(...ap-failed)
  .or(...loading-ap)
```

Error context: locator resolved to **2** elements — both `tts-planner-loading-ap`
and `tts-allocation-levers` visible at once. The same file already documents this
class of bug for the hero assert (lines 34–35). F000 happened to pass when only
one matched. **Not caused by helper extract** (no AP-load / UI change). Asserts
not weakened in this stage.

## Metrics for README

- Planner 1350 / TTS 1012
- Unit tests 384

## Next

F002 — `usePlannerGoalDrafts` — only after user **go**.
