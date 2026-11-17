# REPORT-D001 - Constants + pure format

| Field | Value |
|-------|-------|
| Spec | [SPEC-D001-constants-format.md](../SPEC-D001-constants-format.md) |
| Result | GREEN |
| Code change | extract layout constants + format helpers into `storeAudit/` |

## Environment

- Branch: `refactor/store-audit-drawer-split`
- Unrelated dirty: `.env.docker.example` (not touched)

## What changed

| Path | Action |
|------|--------|
| `web/src/components/planner/storeAudit/storeAuditLayout.ts` | **added** — Inspect dialog / sandbox overlay / hero min-height constants |
| `web/src/components/planner/storeAudit/storeAuditFormat.ts` | **added** — `formatSigned`, `formatScore`, `scoreDisplayForUnit` |
| `web/src/components/planner/storeAudit/storeAuditLayout.test.ts` | **added** |
| `web/src/components/planner/storeAudit/storeAuditFormat.test.ts` | **added** |
| `web/src/components/planner/StoreAuditDrawer.tsx` | imports from `storeAudit/*`; local constants / `formatSigned` / inline unit bounds removed |

No page / props API changes. Comments on layout constants preserved in the layout module.

## Line counts (physical)

| File | D000 | D001 |
|------|------|------|
| `StoreAuditDrawer.tsx` | 931 | **928** (−3) |
| `StoreAuditDrawer.test.tsx` | 331 | 331 |
| `storeAudit/storeAuditLayout.ts` | — | 13 |
| `storeAudit/storeAuditFormat.ts` | — | 25 |
| layout + format tests | — | 22 + 49 |

Orchestrator barely thinner (imports replace inline consts) — expected; real thinning is D002+.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | **exit 0** |
| Lint | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **90 files / 395 tests passed** (~66s; +6 vs D000) |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **1 passed** (~17s) |

Optional TTS e2e not re-run; pre-existing strict-mode flake documented in REPORT-D000.

## Metrics for README

- StoreAuditDrawer.tsx: **928**
- Unit: 395 passed / 90 files

## Conclusion

D001 complete. Ready for **D002** (sandbox panel extract) after user **go**.
Commit when the user asks.
