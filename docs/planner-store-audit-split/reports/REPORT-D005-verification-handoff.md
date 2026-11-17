# REPORT-D005 - Verification / handoff

| Field | Value |
|-------|-------|
| Spec | [SPEC-D005-verification-handoff.md](../SPEC-D005-verification-handoff.md) |
| Result | GREEN (track complete; TTS Playwright flake pre-existing) |
| Code change | docs / metrics only (D004 SKIPPED; no further product code) |

## Environment

- Branch: `refactor/store-audit-drawer-split`
- Base: `main` @ `288edfd` (PR #44 / `v1.39.0-fe-planner-cleanliness`)
- Unrelated dirty: `.env.docker.example` (never part of this track)
- Product + docs still uncommitted until the user asks

## Entry point check

| Consumer | Import |
|----------|--------|
| `PlannerPage.tsx` | `../components/planner/StoreAuditDrawer` |
| `TtsPlannerPage.tsx` | `../components/planner/StoreAuditDrawer` |
| `StoreAuditDrawer.test.tsx` | `./StoreAuditDrawer` |

Single public export remains `StoreAuditDrawer` (no re-export shim needed).

## Final layout

```
web/src/components/planner/
  StoreAuditDrawer.tsx                 # 397 — Dialog orchestrator
  StoreAuditDrawer.test.tsx            # 331
  storeAudit/
    storeAuditLayout.ts                # 13
    storeAuditLayout.test.ts           # 22
    storeAuditFormat.ts                # 25
    storeAuditFormat.test.ts           # 49
    StoreAuditSandboxPanel.tsx         # 448
    StoreAuditHero.tsx                 # 81
    StoreAuditDialogTitle.tsx          # 213
```

Not created (intentionally): `useStoreAuditSandbox.ts` (D004 skipped),
`StoreAuditPlanActualTable.tsx` (table kept inside sandbox panel).

## Before / after

| Metric | D000 baseline | Final (D005) |
|--------|---------------|--------------|
| `StoreAuditDrawer.tsx` | 931 | **397** (−534, −57%) |
| `StoreAuditDrawer.test.tsx` | 331 | 331 |
| Unit tests | 389 / 88 files | **395** / 90 files |
| Orchestrator target ≤400–500 | — | **met** |

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | **exit 0** |
| Lint | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **90 files / 395 tests passed** (~60s) |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **1 passed** (~19s) |
| Playwright TTS | `npx playwright test tests/e2e/tts-planner.spec.ts` | **1 failed** — pre-existing strict `.or` flake |

Asserts not weakened. No UX / props / page API change in this track.

## Stage index outcome

| ID | Status |
|----|--------|
| D000 | DONE |
| D001 | DONE |
| D002 | DONE |
| D003 | DONE |
| D004 | **SKIPPED** (drawer already ≤400; user directed skip) |
| D005 | DONE |

## Handoff — follow-ups **outside** this track

1. **TTS Playwright locator** — `tts-planner.spec.ts` ~L27: `.or(levers|ap-failed|loading-ap)` hits two visible nodes (`tts-planner-loading-ap` + `tts-allocation-levers`). Fix locator / loading lifecycle; do not weaken asserts without evidence.
2. **`web/coverage/` vs `npm run lint`** — local coverage HTML trips eslint; gate remains `eslint src tests`. Consider eslintignore for `coverage/` if team wants `npm run lint` green locally.
3. **Scenario stores** — merging `plannerScenarioStore` / TTS store still out of scope.
4. **Optional later** — `useStoreAuditSandbox` if someone wants state out of the 397-line orchestrator; not required for the line-count goal.
5. **Commit / push / PR** — only when the user asks (docs + `storeAudit/` + drawer changes; never `.env.docker.example`).

## Conclusion

Track **StoreAuditDrawer Split** is complete: thin orchestrator, green gates, same public API, same UX under planner e2e + unit coverage.
