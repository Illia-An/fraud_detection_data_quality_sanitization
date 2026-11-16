# Shared Planner Shell (SDD)

Extract the duplicated "shell" (constants, onboarding/rail effects, reference
selection, answer/undo state, layout) shared by `PlannerPage` and
`TtsPlannerPage`. Origin: independent architecture review, item 1
("FE planner twins are the main cleanliness debt").

## Goal

- One place for rail / onboarding / reference-selection / answer-shell behavior.
- **No user-visible behavior change.** Pure refactor, one stage at a time.

## Out of scope

- `handleRun`, simulation, slope and save-plan logic of `PlannerPage`.
- Merging `plannerScenarioStore` and `ttsPlannerScenarioStore`.
- Splitting `StoreAuditDrawer` (separate task after the shell lands).
- Any backend / API / OpenAPI change.

## Naming

| Kind   | Pattern                         | Example |
|--------|---------------------------------|---------|
| Spec   | `SPEC-S###-<slug>.md`           | `SPEC-S001-constants-and-pure-helpers.md` |
| Report | `reports/REPORT-S###-<slug>.md` | created after the stage is done |

Same number links one spec to its report.

## Branch

`feat/shared-planner-shell`

## Rules

1. One SPEC -> one commit -> one REPORT. Next stage starts only after the
   previous REPORT shows green checks.
2. Commit only when the user asks.
3. Unrelated working-tree changes (e.g. `.env.docker.example`) are never part
   of this track.
4. REPORT records only commands that were actually run, with their result.
5. This README index is updated after every stage.

## Index

| ID   | Stage | Spec | Report | Status |
|------|-------|------|--------|--------|
| S000 | Baseline (before any code change) | [SPEC](./SPEC-S000-baseline.md) | [REPORT](./reports/REPORT-S000-baseline.md) | DONE (green) |
| S001 | Constants + pure helpers | [SPEC](./SPEC-S001-constants-and-pure-helpers.md) | [REPORT](./reports/REPORT-S001-constants-and-pure-helpers.md) | DONE (green, not committed) |
| S002 | Shell hooks (onboarding / play reveal / reference) | [SPEC](./SPEC-S002-shell-hooks.md) | [REPORT](./reports/REPORT-S002-shell-hooks.md) | DONE (green, not committed; manual Docker check pending) |
| S003 | Answer shell (undo / pack / mix state) | [SPEC](./SPEC-S003-answer-shell.md) | [REPORT](./reports/REPORT-S003-answer-shell.md) | DONE (green, not committed; manual pack/undo check pending) |
| S004 | Layout shell (rail + main + at-risk slots) | [SPEC](./SPEC-S004-layout-shell.md) | [REPORT](./reports/REPORT-S004-layout-shell.md) | DONE (green, not committed; manual Docker check pending; `tts-planner` e2e flaky) |
| S005 | Final verification + handoff | [SPEC](./SPEC-S005-verification-handoff.md) | [REPORT](./reports/REPORT-S005-verification-handoff.md) | DONE (automated gates green; tour not walked through in Docker; `tts-planner` e2e flaky, also on `HEAD`) |

## Duplication map (from code review, branch start)

| Block | `PlannerPage.tsx` | `TtsPlannerPage.tsx` | Stage |
|-------|-------------------|----------------------|-------|
| `COLLAPSED_PLAY_REVEAL_MS` local copy | 107 | - (uses none) | S001 |
| `AT_RISK_SUMMARY_RESERVE_PX`, `AT_RISK_GAP_PX`, `AT_RISK_OVERLAY_MAX_HEIGHT` | 109-113 | 85-87 | S001 |
| `PREFERRED_REFERENCE` | 115 | 84 | S001 |
| Reference auto-selection effect | 299-317 | 232-249 | S001 (pure fn) / S002 (hook) |
| Collapsed Play reveal effect | 290-297 | - | S002 |
| Onboarding rail / at-risk / scroll effect | 224-256 | 187-220 | S002 |
| `captureAnswerUndo` / `handleUndoAnswer` / pending-pack/mix state | 356-381 | 307-334 | S003 |
| Rail + main + at-risk accordion JSX | ~1240-1598 | ~900-1225 | S004 |

Line numbers are from the branch start and will drift as stages land.

## Metrics (filled by reports)

| Moment | `PlannerPage.tsx` | `TtsPlannerPage.tsx` |
|--------|-------------------|----------------------|
| Baseline (S000) | 1598 | 1225 |
| After S001 | 1590 | 1214 |
| After S002 | 1532 | 1171 |
| After S003 | 1523 | 1159 |
| After S004 | 1362 | 1023 |
| Final (S005, re-measured) | 1362 | 1023 |

Tests: baseline 78 files / 336 tests; final 84 files / 378 tests.
