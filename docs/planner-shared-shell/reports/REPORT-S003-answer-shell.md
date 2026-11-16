# REPORT-S003 - Answer shell

| Field | Value |
|-------|-------|
| Spec | [SPEC-S003](../SPEC-S003-answer-shell.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` |
| Result | **GREEN** (automated). Manual pack -> undo check pending, see below |
| Commit | not committed (S001, S002 and S003 are all uncommitted) |

## What was done

New hook `web/src/components/planner/useAnswerShell.ts`:
`useAnswerShell<TPlan, TParams extends PlanParams>()`.

| Hook member | Purpose |
|-------------|---------|
| `pendingPackId` / `pendingMixId` + setters | in-flight pack / store-mix id |
| `activeAnswer`, `mixNote` + setters | current answer chip and note |
| `answerUndo` | one-level undo snapshot (read only) |
| `resetAnswerState()` | clears `activeAnswer`, `mixNote`, `answerUndo` (stable identity via `useCallback`) |
| `captureUndo({ plan, params })` | wraps `createAnswerUndoSnapshot` with the current `activeAnswer` / `mixNote`, stores and returns it |
| `clearUndo()` | drops the snapshot (used in `onError` of run / pack) |
| `consumeUndo()` | pops the snapshot, restores `activeAnswer` / `mixNote`, returns it (or `null`) |

Pages:
- `PlannerPage`: `useAnswerShell<FivePercentPlan, PlanParams>()`; `captureAnswerUndo`
  is now a one-liner; `handleUndoAnswer` calls `consumeUndo()` then restores
  `params` and the plan itself. Two inline "reset" triples (month picker change,
  revert draft) replaced by `resetAnswerState()`.
- `TtsPlannerPage`: `useAnswerShell<TtsPlan, TtsPlanParams>()`; same pattern, restores
  `trajectory` / `priorityPower` / `maxMonthly` from the snapshot.
  `applyLoadedPanel` uses `resetAnswerState()` (added to its `useCallback` deps;
  identity is stable, so the load effect behaves as before).
- `handleApplyScenarioPack` / `handleApplyStoreMix` / `handleRun` bodies untouched
  except for `setAnswerUndo(null)` -> `clearUndo()`.
- Both pages dropped the now-unused `ActiveAnswer`, `createAnswerUndoSnapshot`,
  `AnswerUndoSnapshot` imports.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| Types | `npx tsc -b` | exit 0 |
| Lint (source) | `npx eslint src --max-warnings 0` | exit 0 |
| Full unit tests | `npm run test:run` | **83 files, 372 tests passed** (S002: 82 / 365; +1 file, +7 tests) |
| Build | `npm run build` | exit 0 |
| e2e / Docker manual | not run | planned for S004 / S005 |

Page tests were not modified and pass.

New tests, `useAnswerShell.test.ts` (7): empty initial state; `resetAnswerState`
clears answer / note / undo; `resetAnswerState` identity is stable; `captureUndo`
stores a snapshot with a copied `params`; `consumeUndo` returns the snapshot once
and restores answer / note (second call returns `null`); `consumeUndo` without a
capture is a no-op; `clearUndo` leaves answer / note alone.

## Metrics (measured, same method as baseline: non-empty lines)

| File | Baseline (S000) | After S001 | After S002 | After S003 |
|------|-----------------|------------|------------|------------|
| `PlannerPage.tsx` | 1598 | 1590 | 1532 | **1523** |
| `TtsPlannerPage.tsx` | 1225 | 1214 | 1171 | **1159** |

New: `useAnswerShell.ts` (83 non-empty lines), `useAnswerShell.test.ts` (125).

## Deviations from SPEC

- **`resetAnswerState` does not clear `pendingPackId` / `pendingMixId`.** Every
  existing reset site (month picker, revert draft, TTS `applyLoadedPanel`)
  cleared only `activeAnswer`, `mixNote`, `answerUndo`. Clearing the pending ids
  too would enable the pack buttons while a pack request is still in flight, a
  behavior change. Pending ids are still reset by the apply handlers as before.
  The test pins this.
- `captureUndo` takes `{ plan, params }` instead of reading them itself, because the
  hook does not own the plan or the params (they live in the stores / page state).
- Extra helper `clearUndo()` (not in SPEC) for the `onError` paths.

## Residual risks

- Manual check (apply pack -> Undo restores previous plan, both planners) **not
  done**; unit/page tests cover the state logic, not the real flow.
- `handleUndoAnswer` order of state updates changed trivially (answer / note are
  set inside `consumeUndo` before params / plan); all are batched in one event
  handler, so there is no extra render.

## Working tree

- `M .env.docker.example` - unrelated, still excluded.
- Changed in S003: `PlannerPage.tsx`, `TtsPlannerPage.tsx`.
- New in S003: `useAnswerShell.ts`, `useAnswerShell.test.ts`.

## Next

[SPEC-S004 - Layout shell](../SPEC-S004-layout-shell.md). Waiting for user go-ahead.
