# SPEC-D000 - Baseline

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | - |
| Code change | none (track docs only) |
| Report | `reports/REPORT-D000-baseline.md` (written after the stage) |

## Goal

Record a verified "green before" state and a concrete JSX/section inventory of
`StoreAuditDrawer.tsx` so D001+ can be compared against it.

## In scope

1. Confirm branch `refactor/store-audit-drawer-split`; note unrelated dirty files.
2. Measure physical line counts of `StoreAuditDrawer.tsx` and
   `StoreAuditDrawer.test.tsx`.
3. Map logical JSX / helper blocks (constants, format, sandbox state, title,
   hero, Estimate overlay, plan-vs-actual table, pool dialog / toast).
4. From `web/`: `npx tsc -b`, `npx eslint src tests --max-warnings 0`,
   `npm run test:run`.
5. Playwright: `npx playwright test tests/e2e/planner.spec.ts`
   (optional TTS: `tests/e2e/tts-planner.spec.ts` — record flake if it fails;
   do not weaken asserts).
6. Write REPORT-D000; update README index / metrics.

## Out of scope

- Any application source change.

## Acceptance

| Check | Expected |
|-------|----------|
| tsc / eslint src+tests / unit | green, or red recorded as **pre-existing** |
| Line counts + section map | in REPORT-D000 |
| Playwright planner | recorded (pass / fail / skipped) |
| TTS Playwright (if run) | recorded; flake noted, asserts unchanged |

## Risks / rollback

None: no product code changes.
