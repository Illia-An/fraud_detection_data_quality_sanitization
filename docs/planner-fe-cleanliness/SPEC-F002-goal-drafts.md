# SPEC-F002 - Goal / horizon draft state hook

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | F001 report green + user "go" |
| Risk | Low–Med |
| Report | `reports/REPORT-F002-goal-drafts.md` |

## Goal

Extract the duplicated target/horizon + `targetText`/`horizonText` +
clamp/commit pattern into `usePlannerGoalDrafts` (parameterized for
five_percent vs TTS clamps/defaults from existing schemas/bounds).

## In scope

1. Hook owning draft text state, committed values, and `commitGoalDrafts`
   (or equivalent) used by Run / pack flows.
2. Both pages use the hook; Run still commits the same way before calling APIs.
3. No UX copy or control layout change.

## Out of scope

- Changing clamp bounds or defaults.
- Export chrome (F003).
- Simulation orchestration.

## Acceptance

| Check | Expected |
|-------|----------|
| Both pages use the hook | yes |
| tsc / lint / unit / Playwright | green |
| UX | unchanged (same inputs, same commit-on-blur / Run behavior) |

## Risks / rollback

- TTS currently clamps inline in `handleRun` without a shared `commitGoalDrafts`
  helper — hook must preserve that timing. Rollback: `git revert`.
