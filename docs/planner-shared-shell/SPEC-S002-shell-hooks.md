# SPEC-S002 - Shell hooks

| Field | Value |
|-------|-------|
| Status | DONE (manual Docker check pending) |
| Depends on | S001 report green |
| Risk | Medium (effects and timers) |

## Goal

Replace duplicated `useEffect` blocks with small, tested hooks.

## Context

- Onboarding effect: same behavior in both pages, differing only by step-id
  prefix (`planner-*` vs `tts-planner-*`) and by the DOM `data-onboarding` value.
- Collapsed Play reveal timer exists in `PlannerPage` and mirrors
  `SanitizationPage` / `TtsKitchenPage` (out of this track, noted only).
- Reference auto-selection effect shape is identical (uses `pickReference`).

## In scope

New files under `web/src/components/planner/`:

1. `usePlannerOnboardingShell.ts`
   - input: `{ prefix: 'planner' | 'tts-planner', setControlsOpen, setAtRiskExpanded }`
   - same step ids, same 80 ms timeouts, same `scrollIntoView` options,
     same cleanup.
2. `useCollapsedPlayReveal.ts`
   - input: `controlsOpen`
   - returns `showCollapsedPlay`; uses `PLANNER_COLLAPSED_PLAY_REVEAL_MS`.
3. `useReferenceSelection.ts`
   - input: `refs`, initial/preferred, returns
     `{ referenceYear, referenceMonth, setReferenceYear, setReferenceMonth }`
     and runs the `pickReference` effect.

Pages call the hooks and drop their inline effects. Public props of child
components stay unchanged.

## Out of scope

- Moving `SanitizationPage` / `TtsKitchenPage` to the new hooks (follow-up).
- Answer shell (S003), layout (S004).

## Acceptance

| Check | Expected |
|-------|----------|
| Hook tests (`renderHook`, fake timers) | onboarding steps: levers opens rail and collapses at-risk; hero scrolls after 80 ms; at-risk/inspect expands and scrolls; cleanup clears timers; play reveal waits 250 ms and resets when rail opens |
| `PlannerPage.test.tsx`, `TtsPlannerPage.test.tsx` | unchanged and passing |
| `npm run lint` / `test:run` / `build` | green |
| Manual (Docker) | tour on both planners; collapse/expand rail; collapsed Play appears after ~250 ms |

## Risks / rollback

- Risk: effect dependency arrays differ and cause extra runs. Keep the same
  dependencies; verify with tests that assert call counts.
- Rollback: `git revert` of the stage commit.
