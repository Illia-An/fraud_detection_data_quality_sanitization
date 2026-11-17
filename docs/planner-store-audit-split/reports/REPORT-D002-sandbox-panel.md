# REPORT-D002 - Sandbox panel extract

| Field | Value |
|-------|-------|
| Spec | [SPEC-D002-sandbox-panel.md](../SPEC-D002-sandbox-panel.md) |
| Result | GREEN |
| Code change | Estimate overlay + pool dialog + apply toast → `StoreAuditSandboxPanel` |

## Environment

- Branch: `refactor/store-audit-drawer-split`
- Unrelated dirty: `.env.docker.example` (not touched)

## What changed

| Path | Action |
|------|--------|
| `web/src/components/planner/storeAudit/StoreAuditSandboxPanel.tsx` | **added** — accordion overlay, plan/actual table, actions, pool Dialog, apply Snackbar (props down) |
| `web/src/components/planner/StoreAuditDrawer.tsx` | wires panel; sandbox JSX / pool / toast removed; unused MUI imports cleaned |

`StoreAuditPlanActualTable` not extracted separately — table stays inside the panel for this stage (SPEC optional).

State + handlers (`useState`, recalculate/apply/reset) remain on the drawer orchestrator (D004).

Public `StoreAuditDrawer` props / page wiring unchanged.

## Line counts (physical)

| File | D001 | D002 |
|------|------|------|
| `StoreAuditDrawer.tsx` | 928 | **596** (−332) |
| `StoreAuditDrawer.test.tsx` | 331 | 331 |
| `storeAudit/StoreAuditSandboxPanel.tsx` | — | 448 |

Vs D000 baseline (931): drawer **−335** lines.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | **exit 0** (after restoring `TextField` import used by store Autocomplete) |
| Lint | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **90 files / 395 tests passed** (~62s) |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **1 passed** (~17s; Inspect sandbox path) |

Optional TTS e2e not re-run (flake known from D000).

## Metrics for README

- StoreAuditDrawer.tsx: **596**
- Unit: 395 passed / 90 files

## Conclusion

D002 complete. Ready for **D003** (hero + title chrome) after user **go**.
Commit when the user asks.
