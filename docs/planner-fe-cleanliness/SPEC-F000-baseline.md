# SPEC-F000 - Baseline

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | - |
| Code change | none |
| Report | `reports/REPORT-F000-baseline.md` (written after the stage) |

## Goal

Record a verified "green before" state and a concrete duplication inventory so
F001+ can be compared against it.

## In scope

1. Confirm branch `refactor/fe-planner-cleanliness`; note unrelated dirty files.
2. Measure physical line counts of `PlannerPage.tsx` and `TtsPlannerPage.tsx`.
3. List duplicated helpers / goal-draft / export chrome blocks (see README map).
4. From `web/`: `npx tsc -b`, `npm run lint`, `npm run test:run`.
5. Playwright: `npx playwright test tests/e2e/planner.spec.ts tests/e2e/tts-planner.spec.ts`
   (record if browser/env unavailable as skipped with reason).
6. Write REPORT-F000; update README metrics.

## Out of scope

- Any source change.

## Acceptance

| Check | Expected |
|-------|----------|
| tsc / lint / unit | green, or red recorded as **pre-existing** |
| Line counts + duplication map | in REPORT-F000 |
| Playwright | recorded (pass / fail / skipped) |

## Risks / rollback

None: no code changes.
