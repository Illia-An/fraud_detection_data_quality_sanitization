# REPORT-F002 - Goal / horizon draft state hook

| Field | Value |
|-------|-------|
| Spec | [SPEC-F002-goal-drafts.md](../SPEC-F002-goal-drafts.md) |
| Result | GREEN (tsc/lint/unit/planner e2e; TTS e2e same pre-existing flake as F001) |
| Previous | [REPORT-F001](./REPORT-F001-pure-helpers.md) |

## What changed

| File | Change |
|------|--------|
| `web/src/components/planner/usePlannerGoalDrafts.ts` | new hook + `fivePercentGoalClamps` / `ttsGoalClamps` / TTS clamp helpers |
| `web/src/components/planner/usePlannerGoalDrafts.test.ts` | new (3 tests) |
| `web/src/pages/PlannerPage.tsx` | uses hook; removed local goal state / `commitGoalDrafts` / blur clamp bodies |
| `web/src/pages/TtsPlannerPage.tsx` | uses hook; removed page-local `clampTarget`/`clampHorizon`; Run/pack call `commitGoalDrafts()` |

UX controls unchanged (same fields, same commit-on-blur / commit-before-run).
No API / simulation changes.

## Line counts

| File | F000 | F001 | F002 | Δ vs F000 |
|------|------|------|------|-----------|
| PlannerPage.tsx | 1406 | 1350 | **1327** | −79 |
| TtsPlannerPage.tsx | 1061 | 1012 | **976** | −85 |

## Checks (from `web/`, actually run)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | exit 0 |
| Lint | `npx eslint src tests --max-warnings 0` | exit 0 |
| Full unit | `npm run test:run` | **87 files / 387 tests** (384 + 3), exit 0 |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **passed** |
| Playwright tts | `tests/e2e/tts-planner.spec.ts` | **failed** — same `.or(loading\|levers)` strict-mode flake as F001 |

## F003 decision

F001+F002 already deliver a focused, reviewable diff. **Recommend deferring F003**
(export/save chrome) to a follow-up PR unless the user says **go** for F003.

## Metrics for README

- Planner 1327 / TTS 976
- Unit tests 387

## Next

User choice: **go** F003, or close the track (commit / PR) with F000–F002 only.
