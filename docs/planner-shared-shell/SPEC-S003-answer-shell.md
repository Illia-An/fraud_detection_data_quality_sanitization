# SPEC-S003 - Answer shell

| Field | Value |
|-------|-------|
| Status | DONE (green, not committed) - see [REPORT-S003](./reports/REPORT-S003-answer-shell.md) |
| Depends on | S002 report green |
| Risk | Medium (generic typing, shared state shape) |

## Goal

Share the "scenario answer" UI state and undo plumbing between the two pages.

## Context

Both pages hold the same state group:
`pendingPackId`, `pendingMixId`, `activeAnswer`, `mixNote`, `answerUndo`,
and implement `captureAnswerUndo` / `handleUndoAnswer` almost identically.
`answerUndo.ts` is already generic (`AnswerUndoSnapshot<TPlan, TParams>`).

## In scope

1. `web/src/components/planner/useAnswerShell.ts`
   - generic over `TPlan`, `TParams`
   - owns `pendingPackId`, `pendingMixId`, `activeAnswer`, `mixNote`, `answerUndo`
   - exposes `resetAnswerState()` for the "new baseline / clear" paths
   - exposes `captureUndo(plan, params, ...)` and `consumeUndo()` helpers that
     wrap the existing `createAnswerUndoSnapshot`.
2. Both pages switch to the hook; plan-specific apply logic stays in the page.
3. Unit tests for the hook (reset, capture, consume, no stale undo).

## Out of scope

- `handleApplyScenarioPack` / `handleApplyStoreMix` bodies (plan-specific).
- Store merging.

## Acceptance

| Check | Expected |
|-------|----------|
| Hook tests | reset clears all fields; capture then consume returns snapshot once; consume without capture is a no-op |
| Existing page tests | unchanged and passing |
| `lint` / `test:run` / `build` | green |
| Manual | apply pack -> undo restores previous plan on both planners |

## Risks / rollback

- Risk: type inference around generics. Keep explicit type parameters at the
  call sites.
- Rollback: `git revert` of the stage commit.
