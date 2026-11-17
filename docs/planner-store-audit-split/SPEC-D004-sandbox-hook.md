# SPEC-D004 - Sandbox state hook (optional)

| Field | Value |
|-------|-------|
| Status | SKIPPED |
| Depends on | D003 |
| Code change | hook extract |
| Report | `reports/REPORT-D004-sandbox-hook.md` |

## Goal

If the orchestrator is still heavy after D001–D003, extract sandbox
`useState` + recalculate / clear / apply / reset into
`useStoreAuditSandbox`. UI stays in the panel. **Stop earlier** if D001–D003
already yield a reasonably thin PR — mark this stage SKIPPED with rationale.

## In scope

1. `useStoreAuditSandbox.ts` — state, `useEffect` reset-on-open, handlers that
   call existing schema helpers (`previewSandboxEvenSplit`,
   `applySandboxEvenSplitToPlan`, etc.).
2. Drawer / panel consume the hook; no behavior change.
3. Unit tests for hook behavior where practical (or keep coverage via drawer
   tests).
4. Gates + REPORT + README (or SKIPPED note).

## Out of scope

- Changing even-split math or page `onApplyPlan` contracts.
- Further unrelated splits.

## Acceptance

| Check | Expected |
|-------|----------|
| Apply / preview / reset-on-store-change | identical |
| Orchestrator measurably thinner **or** stage SKIPPED with reason | documented |
| Quality gates | green (or pre-existing noted) |

## Risks / rollback

Revert hook extract; state returns to drawer.
