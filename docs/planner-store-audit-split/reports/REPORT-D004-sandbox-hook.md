# REPORT-D004 - Sandbox state hook

| Field | Value |
|-------|-------|
| Spec | [SPEC-D004-sandbox-hook.md](../SPEC-D004-sandbox-hook.md) |
| Result | **SKIPPED** (user: skip D004 → go D005) |
| Code change | none |

## Rationale

After D003, `StoreAuditDrawer.tsx` is **397** lines — already inside the track
target (≤ ~400–500). SPEC-D004 allows stopping early when D001–D003 yield a
thin enough orchestrator.

Sandbox `useState` + recalculate/apply/reset remain on the drawer; UI stays in
`StoreAuditSandboxPanel`. Optional follow-up outside this track if further
thinning is desired later.

## Checks

None (no code change). Final gates run under D005.
