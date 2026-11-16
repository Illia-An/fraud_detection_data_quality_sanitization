# SPEC-S004 - Layout shell

| Field | Value |
|-------|-------|
| Status | DONE (green, not committed) - see [REPORT-S004](./reports/REPORT-S004-layout-shell.md) |
| Depends on | S003 report green |
| Risk | Medium-High (large JSX, visual regressions) |

## Goal

Share the page frame: controls rail, main column, collapsed Play button and the
At-risk accordion/overlay geometry.

## Context

Both pages render the same frame with different content:
- rail width from `controlsOpen` (`PLANNER_RAIL_WIDTH_PX` / `PLANNER_RAIL_COLLAPSED_PX`)
- collapsed Play button after the reveal delay
- At-risk summary + overlay using `AT_RISK_*` geometry

## In scope

1. `web/src/components/planner/PlannerPageShell.tsx`
   - props: `controlsOpen`, `onToggleControls`, `showCollapsedPlay`,
     `onCollapsedPlay`, plus slots `rail`, `children` (main), `atRisk`, `drawer`
   - owns only layout/geometry; no data fetching, no plan logic.
2. Apply to `TtsPlannerPage` first (smaller, e2e coverage), then `PlannerPage`.
3. Keep every `data-onboarding` attribute and i18n key unchanged.

## Out of scope

- Hero charts, `AtRiskDeltaTable`, `StoreAuditDrawer` internals.
- Visual redesign.

## Acceptance

| Check | Expected |
|-------|----------|
| Component test | renders slots; rail width follows `controlsOpen`; collapsed Play shows only when closed and revealed |
| Existing page tests | unchanged and passing |
| e2e `tts-*` | pass (local browser) |
| `lint` / `test:run` / `build` | green |
| Manual (Docker) | both planners look and behave the same as baseline: rail, Play, At-risk expand, tour highlights |

## Risks / rollback

- Risk: layout shift or lost `data-onboarding` anchors.
  Mitigate: compare DOM anchors before/after; apply to one page per commit
  if the diff is large.
- Rollback: `git revert` of the stage commit(s).
