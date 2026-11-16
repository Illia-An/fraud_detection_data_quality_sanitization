# REPORT-S000 - Baseline

| Field | Value |
|-------|-------|
| Spec | [SPEC-S000](../SPEC-S000-baseline.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` |
| Source code changed | none |
| Result | **GREEN** (one local-only lint note, see below) |

## What was done

- Created `docs/planner-shared-shell/` with README and SPEC-S000...S005.
- Ran web quality gates on the unchanged branch and measured file sizes.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| Lint (whole `web/`) | `npm run lint` | exit 1: 3 warnings, all in generated `web/coverage/lcov-report/*.js` ("Unused eslint-disable directive") |
| Lint (source) | `npx eslint src --max-warnings 0` | **exit 0**, no problems |
| Unit tests | `npm run test:run` | **78 files, 336 tests passed**, ~55 s |
| Build | `npm run build` | **exit 0** (`tsc -b && vite build`, ~43 s); only the existing chunk-size warning |
| Playwright e2e | not run in S000 | deferred to S004/S005 |

### Lint note (pre-existing, not part of this track)

`npm run lint` fails locally only because an earlier local
`npm run test:coverage` left `web/coverage/lcov-report/`. That folder is in
`.gitignore` (`web/coverage/`), so CI does not have it and git does not track
it. Source lint is clean. Nothing was deleted or changed.
Use `npx eslint src --max-warnings 0` as the lint gate for later reports, or
remove `web/coverage/` before running `npm run lint`.

## Metrics (measured)

| File | Lines |
|------|-------|
| `web/src/pages/PlannerPage.tsx` | 1598 |
| `web/src/pages/TtsPlannerPage.tsx` | 1225 |
| `web/src/components/planner/plannerShell.ts` | 8 |

Planner-related test files present: `PlannerPage.test.tsx`,
`TtsPlannerPage.test.tsx`, `plannerRunGuards.test.ts`,
`ttsPlannerRunGuards.test.ts`, `plannerScenarioStore.test.ts`,
`ttsPlannerScenarioStore.test.ts`, `plannerPathLeversSummary.test.ts`,
`plannerSlack.test.ts`, `PlannerContextStrip.test.tsx`, `ttsHeroSeries.test.ts`.

## Working tree

- `M .env.docker.example` - unrelated, pre-existing; excluded from this track.
- `?? docs/planner-shared-shell/` - this track's docs.
- `web/dist/` produced by the build is git-ignored.

## Deviations from SPEC

- Lint acceptance wording ("`npm run lint` exit 0") was not met locally due to
  the ignored coverage artifact; recorded as pre-existing above.
- e2e step was optional in the SPEC and was not run.

## Residual risks

- None for this stage (no code changes).

## Reference numbers for later stages

Later reports compare against: **336 tests / 78 files**, source lint clean,
build green, **PlannerPage 1598**, **TtsPlannerPage 1225** lines.

## Next

[SPEC-S001 - Constants and pure helpers](../SPEC-S001-constants-and-pure-helpers.md).
Waiting for user confirmation before starting code changes.
