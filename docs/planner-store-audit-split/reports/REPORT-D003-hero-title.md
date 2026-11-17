# REPORT-D003 - Hero + title chrome

| Field | Value |
|-------|-------|
| Spec | [SPEC-D003-hero-title.md](../SPEC-D003-hero-title.md) |
| Result | GREEN |
| Code change | `StoreAuditHero` + `StoreAuditDialogTitle` extracts |

## Environment

- Branch: `refactor/store-audit-drawer-split`
- Unrelated dirty: `.env.docker.example` (not touched)

## What changed

| Path | Action |
|------|--------|
| `web/src/components/planner/storeAudit/StoreAuditHero.tsx` | **added** — slope vs legacy hero region |
| `web/src/components/planner/storeAudit/StoreAuditDialogTitle.tsx` | **added** — title, store picker, signal chip, warn/audit tooltips, close |
| `web/src/components/planner/StoreAuditDrawer.tsx` | wires both; chart/title JSX removed; imports cleaned |

Boost Alert + UnreachableRecommendationCard stay on the orchestrator (already thin / existing children).

Public `StoreAuditDrawer` props / page wiring unchanged.

## Line counts (physical)

| File | D002 | D003 |
|------|------|------|
| `StoreAuditDrawer.tsx` | 596 | **397** (−199) |
| `storeAudit/StoreAuditHero.tsx` | — | 81 |
| `storeAudit/StoreAuditDialogTitle.tsx` | — | 213 |

Vs D000 baseline (931): drawer **−534** lines. Orchestrator is now inside the track target (≤ ~400–500).

## Note on D004

SPEC-D004 is optional if D001–D003 already thin the drawer. At **397** lines, sandbox state/handlers could stay on the orchestrator; recommend **SKIP** D004 unless the user wants the hook for clarity. Await **go** / skip instruction.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | **exit 0** |
| Lint | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **90 files / 395 tests passed** (~56s) |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **1 passed** (~16s) |

Optional TTS e2e not re-run (flake known from D000).

## Metrics for README

- StoreAuditDrawer.tsx: **397**
- Unit: 395 passed / 90 files

## Conclusion

D003 complete. Ready for **D004** (optional hook) or **D005** (verification/handoff) after user **go**.
Commit when the user asks.
