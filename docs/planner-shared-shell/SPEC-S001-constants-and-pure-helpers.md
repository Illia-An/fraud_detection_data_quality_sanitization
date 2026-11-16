# SPEC-S001 - Constants and pure helpers

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | S000 green |
| Risk | Low |

## Goal

Remove identical constants and the identical reference-selection rule from the
two pages and put them in the shared shell module.

## Context

- `PlannerPage.tsx` keeps a local `COLLAPSED_PLAY_REVEAL_MS = 250`, although
  `plannerShell.ts` already exports `PLANNER_COLLAPSED_PLAY_REVEAL_MS = 250`.
- `AT_RISK_SUMMARY_RESERVE_PX`, `AT_RISK_GAP_PX`, `AT_RISK_OVERLAY_MAX_HEIGHT`
  and `PREFERRED_REFERENCE` are declared in both pages with identical values.
- The "keep selection if valid, else prefer 2025-12, else latest" rule is
  duplicated inside two `useEffect` bodies.

## In scope

1. `web/src/components/planner/plannerShell.ts`
   - add `PLANNER_AT_RISK_SUMMARY_RESERVE_PX` (80), `PLANNER_AT_RISK_GAP_PX` (12),
     `PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT` ('45vh'), `PLANNER_PREFERRED_REFERENCE`.
   - add pure `pickReference(refs, currentYear, currentMonth)` returning
     `{ year, month } | null`:
     - `refs` empty -> `null`
     - current selection present in `refs` -> same selection (no change)
     - else preferred reference if present
     - else last element of `refs`
2. `PlannerPage.tsx` and `TtsPlannerPage.tsx`
   - delete local duplicates, import shared ones.
   - replace the inline selection logic with `pickReference`.
3. New unit test `plannerShell.test.ts` covering all `pickReference` branches.

## Out of scope

- Hooks (S002), JSX layout (S004).
- Changing any value (all constants keep their current numbers).

## Acceptance

| Check | Expected |
|-------|----------|
| `plannerShell.test.ts` | new tests pass (empty, valid-keep, invalid-fallback-to-preferred, no-preferred-fallback-to-last) |
| `npm run lint` | exit 0, 0 warnings |
| `npm run test:run` | same pass set as baseline plus new tests |
| `npm run build` | exit 0 |
| Behavior | identical; no snapshot/DOM changes |
| Diff | no value changes in constants; local duplicates removed |

## Risks / rollback

- Risk: effect dependencies change when logic moves. Keep the effect body in
  the page; only the decision moves into `pickReference`.
- Rollback: `git revert` of the single stage commit.
