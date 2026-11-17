# SPEC-D001 - Constants + pure format

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | D000 |
| Code change | extract only |
| Report | `reports/REPORT-D001-constants-format.md` |

## Goal

Move layout constants and pure formatting helpers out of
`StoreAuditDrawer.tsx` into `storeAudit/*.ts` with unit tests. Drawer only
imports; behavior unchanged.

## In scope

1. Create `web/src/components/planner/storeAudit/storeAuditLayout.ts` with
   `INSPECT_DIALOG_*`, sandbox overlay sizes, hero min heights (and any
   derived values that today live at module top).
2. Create `storeAuditFormat.ts` with `formatSigned` (+ score digits / bounds
   wrappers if they are pure and local).
3. Update `StoreAuditDrawer.tsx` to import from those modules.
4. Add focused unit tests for extracted pure helpers.
5. Quality gates from README; write REPORT; update README metrics.

## Out of scope

- Extracting React UI / hooks.
- Changing props API or page wiring.
- Renaming i18n keys.

## Acceptance

| Check | Expected |
|-------|----------|
| Existing `StoreAuditDrawer` tests | still green |
| New helper unit tests | added and green |
| tsc / eslint src+tests / unit / Playwright planner | green (or pre-existing noted) |
| UX / props | unchanged |

## Risks / rollback

Revert the extract commit; constants/helpers return inline.
