# SPEC-D003 - Hero + title chrome

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | D002 |
| Code change | UI extract |
| Report | `reports/REPORT-D003-hero-title.md` |

## Goal

Extract Inspect hero region (slope dual-panel vs legacy
`StoreHeroEvaluationChart`) into `StoreAuditHero`, and optionally Dialog title
chrome (store Autocomplete + audit/sandbox tooltips) into
`StoreAuditDialogTitle`.

## In scope

1. `StoreAuditHero.tsx` — slope vs legacy branch; layout min-heights from
   `storeAuditLayout`.
2. Optional `StoreAuditDialogTitle.tsx` — title prefix, store picker, signal
   chip, warn/audit tooltips, close.
3. Orchestrator wires children; props API of `StoreAuditDrawer` unchanged.
4. Gates + REPORT + README.

## Out of scope

- Sandbox hook extract (D004).
- Changing chart internals (`CumulativeSlopeHeroChart` / legacy chart).

## Acceptance

| Check | Expected |
|-------|----------|
| Slope and legacy Inspect paths | visually/behaviorally same |
| Existing tests | green |
| Quality gates | green (or pre-existing noted) |

## Risks / rollback

Revert extract commit(s).
