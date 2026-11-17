# SPEC-D002 - Sandbox panel extract

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | D001 |
| Code change | UI extract |
| Report | `reports/REPORT-D002-sandbox-panel.md` |

## Goal

Extract the Estimate accordion overlay (and plan-vs-actual table UI inside it)
into `StoreAuditSandboxPanel` (props down). Apply / preview / reset behavior
identical.

## In scope

1. `StoreAuditSandboxPanel.tsx` receives state/handlers as props (no new
   behavior).
2. Optionally extract table markup to `StoreAuditPlanActualTable.tsx` if it
   keeps the panel readable.
3. Pool confirm dialog / toast may move with the panel or stay on the
   orchestrator — prefer co-location with sandbox UI.
4. Existing drawer tests remain green; gates + REPORT + README update.

## Out of scope

- Moving sandbox state into a hook (D004).
- Schema / sandbox math changes.
- Title / hero extract (D003).

## Acceptance

| Check | Expected |
|-------|----------|
| Apply / Recalculate / Reset | same as before |
| Existing tests | green |
| Quality gates | green (or pre-existing noted) |

## Risks / rollback

Revert extract; panel JSX returns to drawer.
