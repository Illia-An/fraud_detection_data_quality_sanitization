# SPEC-S000 - Baseline

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | - |
| Code change | none |
| Report | [REPORT-S000](./reports/REPORT-S000-baseline.md) |

## Goal

Record a verified "green before" state so every later stage can be compared
against it.

## In scope

- Run and record the web quality gates on the clean branch.
- Record line counts of both pages and of `plannerShell.ts`.
- Record which planner-related test files exist.

## Out of scope

- Any source change.

## Steps

1. Confirm branch is `feat/shared-planner-shell`; note unrelated dirty files.
2. In `web/`: `npm run lint`.
3. In `web/`: `npm run test:run`.
4. In `web/`: `npm run build`.
5. Measure line counts of `PlannerPage.tsx`, `TtsPlannerPage.tsx`, `plannerShell.ts`.
6. Optionally run the TTS e2e subset if the local browser is available.
7. Write REPORT-S000.

## Acceptance

| Check | Command | Expected |
|-------|---------|----------|
| Lint | `npm run lint` | exit 0, 0 warnings |
| Unit | `npm run test:run` | all pass |
| Build | `npm run build` | exit 0 |
| Metrics | line count | recorded in REPORT-S000 |

If any check is red at baseline, the failure is recorded as **pre-existing**
and is not fixed in this track unless the user decides otherwise.

## Risks / rollback

None: no code changes.
