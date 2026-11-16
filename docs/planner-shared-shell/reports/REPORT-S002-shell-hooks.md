# REPORT-S002 - Shell hooks

| Field | Value |
|-------|-------|
| Spec | [SPEC-S002](../SPEC-S002-shell-hooks.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` |
| Result | **GREEN** (automated). Manual Docker check still pending, see below |
| Commit | not committed (S001 and S002 are both uncommitted) |

## What was done

Three hooks in `web/src/components/planner/`, each replacing duplicated inline
`useEffect` code:

| Hook | Replaces | Used by |
|------|----------|---------|
| `usePlannerOnboardingShell({ prefix, setControlsOpen, setAtRiskExpanded })` | the ~35-line onboarding effect (rail / At-risk / scroll), identical apart from the step-id prefix | `PlannerPage` (`'planner'`), `TtsPlannerPage` (`'tts-planner'`) |
| `useCollapsedPlayReveal(controlsOpen)` | `showCollapsedPlay` state + timer effect | `PlannerPage` only |
| `useReferenceSelection(refs, initial?)` | `referenceYear/Month` state + `pickReference` effect | both pages |

Behavior kept identical: same step ids, same 80 ms scroll delay, same
`scrollIntoView` options, same cleanup, same 250 ms play reveal, same initial
selection (`Planner` starts at 2025-12, `TTS` starts at `null`). The two
`setReference*` setters are still returned, because both pages call them from
the month pickers.

Both pages dropped the now-unused `useOnboardingStore` import; `PlannerPage`
also dropped `useEffect`.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| Types | `npx tsc -b` | exit 0 |
| Lint (source) | `npx eslint src --max-warnings 0` | exit 0 |
| Focused tests | 3 hook tests + `plannerShell` + both page tests + `src/onboarding` | 11 files, 62 tests passed |
| Full unit tests | `npm run test:run` | **82 files, 365 tests passed** (S001: 79 / 341; +3 files, +24 tests) |
| Build | `npm run build` | exit 0 |
| e2e / Docker manual | not run | planned for S004 / S005 |

New tests (24):
- `usePlannerOnboardingShell.test.ts` - 14 (7 cases x both prefixes): inactive tour
  does nothing; levers opens rail and collapses At-risk; hero collapses and
  scrolls after 80 ms; at-risk expands and scrolls; inspect also scrolls the
  inspect target; a pending scroll is cancelled when the step changes; steps of
  the other planner are ignored.
- `useCollapsedPlayReveal.test.ts` - 4: hidden while open; reveals exactly at
  the delay; hides when the rail reopens; pending reveal is cancelled.
- `useReferenceSelection.test.ts` - 6: empty stays empty; preferred month on
  arrival; latest month fallback; initial selection kept; manual setters kept;
  a selection that disappears is repaired.

jsdom prints `Not implemented: navigation` during the page export tests. The
tests pass; it is jsdom logging, not a failure.

## Metrics (measured)

| File | Baseline (S000) | After S001 | After S002 |
|------|-----------------|------------|------------|
| `PlannerPage.tsx` | 1598 | 1590 | **1532** |
| `TtsPlannerPage.tsx` | 1225 | 1214 | **1171** |

`git diff --stat -- web` (tracked files only, S001 + S002 together): 3 files,
+73 / -156. New files: 3 hooks (59 + 21 + 31 lines) and 3 hook test files.

Pages together are now 101 lines shorter than at baseline. The shared logic
now lives once, with its own tests.

## Deviations from SPEC

- `useCollapsedPlayReveal` is used by `PlannerPage` only. `TtsPlannerPage` has no
  collapsed-Play button or reveal timer, so wiring the hook there would add
  new behavior. Left as is on purpose. `SanitizationPage` and `TtsKitchenPage`
  still keep their own copy of this timer (out of this track, noted in SPEC).
- `useReferenceSelection` takes an optional `initial` because the two pages
  start differently (Planner: 2025-12, TTS: `null`).
- The hook also keeps the `prefix` and `setAtRiskExpanded` in the effect
  dependency list. Both are stable (a string constant and a `useState`
  setter), so effect timing is unchanged.

## Residual risks

- Manual Docker check (tour on both planners, rail collapse/expand, collapsed
  Play after ~250 ms) is **not done yet**; unit tests cover the logic with fake
  timers, not the real browser scroll.
- Hook tests cast the onboarding `stepId` (`as never`) because the store types it
  as a closed union; acceptable in tests only.

## Working tree

- `M .env.docker.example` - unrelated, still excluded.
- Changed: `plannerShell.ts`, `PlannerPage.tsx`, `TtsPlannerPage.tsx`.
- New: 3 hooks + 3 hook tests + `plannerShell.test.ts` (S001).

## Next

[SPEC-S003 - Answer shell](../SPEC-S003-answer-shell.md). Waiting for user go-ahead.
