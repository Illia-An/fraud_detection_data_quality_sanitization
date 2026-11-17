# REPORT-F000 - Baseline

| Field | Value |
|-------|-------|
| Spec | [SPEC-F000-baseline.md](../SPEC-F000-baseline.md) |
| Result | GREEN (local lint caveat — same as shared-shell S000) |
| Code change | none (track docs only) |

## Environment

- Branch: `refactor/fe-planner-cleanliness`
- HEAD: `2aa31f8` (Merge pull request #43 — tier-rename)
- `git status --short`: ` M .env.docker.example` (unrelated; not part of this track)

## Line counts (physical lines = `(Get-Content path).Count`)

| File | Lines |
|------|-------|
| `web/src/pages/PlannerPage.tsx` | **1406** |
| `web/src/pages/TtsPlannerPage.tsx` | **1061** |

(Task brief cited ~1362 / ~1023 — that was likely non-blank or an older snapshot.
This report uses full physical line counts going forward.)

## Duplication inventory

| Block | PlannerPage | TtsPlannerPage | Notes for F001+ |
|-------|-------------|----------------|-----------------|
| Refs list | `availableReferences` (~L115–128) | `referencesOf` (~L92–105) | Same algorithm; panel row shape differs |
| Baseline at ref | `baselineRowsAtReference` → `{store_id, five_percent}` | `baselineAt` → `{store_id, tts}` | Mapper / metric key |
| Chain mean | `meanChain` on `five_percent` | `meanMinutes` on `tts` | Equal-weight mean; product-lock comment on Planner |
| CSV | `downloadPlanCsv` (~L138–169) | `downloadTtsPlanCsv` (~L1033–1060) | Same blob/anchor pattern; filename + column fill differ slightly |
| Clamps | `clampPlanTarget` / `clampPlanHorizon` from schemas | local `clampTarget` / `clampHorizon` | TTS uses schema mins/maxes inline |
| Goal drafts | `target`/`horizon` + `*Text` + `commitGoalDrafts` | same state; commit inlined in `handleRun` | F002 hook |
| Excel chrome | `excelExporting` / `excelExportError` + handlers | same | F003 optional |

Already shared (out of this extract): `PlannerPageShell`, onboarding/answer/reference hooks, docks, many planner components.

## Checks (all actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | exit 0 |
| Lint (whole `web/`) | `npm run lint` | exit 1: 3 warnings in generated `coverage/lcov-report/*.js` |
| Lint (source) | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **84 files / 378 tests passed**, ~85s |
| Playwright | `npx playwright test tests/e2e/planner.spec.ts tests/e2e/tts-planner.spec.ts` | **2 passed** (~29s) |

`npm warn Unknown env config "devdir"` appears throughout — user npmrc, unrelated.

### Lint caveat (pre-existing, not fixed)

Same as Shared Planner Shell REPORT-S000: local `web/coverage/` from a prior
`test:coverage` is gitignored; CI does not see it. For later stages in this
track, treat **source lint** (`npx eslint src tests --max-warnings 0`) as the
gate, or delete `web/coverage/` before `npm run lint`.

## Metrics for README

- PlannerPage: 1406
- TtsPlannerPage: 1061
- Unit: 378 passed / 84 files

## Conclusion

Baseline is usable. Ready for F001 (pure helpers) after user **go**.
