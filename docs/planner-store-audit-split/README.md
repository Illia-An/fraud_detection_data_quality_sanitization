# StoreAuditDrawer Split (SDD)

Split `web/src/components/planner/StoreAuditDrawer.tsx` into focused
subcomponents + pure helpers/constants without UX / API / behavior changes.
Continues after FE planner cleanliness (PR #44 / `v1.39.0-fe-planner-cleanliness`).
Origin: REPORT-S005 follow-up #2, REPORT-F003 handoff.

## Goal

- Cut the Inspect/Audit drawer into understandable pieces under `storeAudit/`.
- Keep `StoreAuditDrawer` as the single page entry (thin orchestrator Dialog).
- **No user-visible behavior change.** Public props API preserved; pages change
  only imports if needed.
- Aspirational orchestrator size after the track: ≤ ~400–500 lines (not at any cost).
  **Met:** final orchestrator **397** lines.

## Out of scope

- Visual redesign, copy / i18n key renames (unless inevitable for extract).
- Backend / OpenAPI / Python.
- Merging `plannerScenarioStore` / TTS scenario store.
- Rewriting sandbox math in `schemas/sandboxPreview` / `planActualGap`
  (UI may only call existing helpers).
- `handleRun` / page logic beyond wiring.
- Fixing TTS Playwright flake (`.or(loading|levers)`) — separate topic;
  do not weaken asserts without evidence.
- Drive-by refactors outside planner Inspect.

## Naming

| Kind   | Pattern                         | Example |
|--------|---------------------------------|---------|
| Spec   | `SPEC-D###-<slug>.md`           | `SPEC-D001-constants-format.md` |
| Report | `reports/REPORT-D###-<slug>.md` | created after the stage |

## Branch

`refactor/store-audit-drawer-split` (from `main` at `288edfd`, after PR #44 /
`v1.39.0-fe-planner-cleanliness`).

## Rules

1. One SPEC -> one commit -> one REPORT. Next stage only after a green REPORT
   and the user says "go".
2. Commit / push / PR only when the user asks.
3. Unrelated working-tree changes (`.env.docker.example`, `.env`, `.env.docker`)
   are never part of this track.
4. REPORT records only commands that were actually run.
5. This README index / metrics are updated after every stage.
6. Prefer extract of constants / pure helpers first; then UI panels; hook last.

## Final layout

```
web/src/components/planner/
  StoreAuditDrawer.tsx              # thin Dialog orchestrator (397)
  storeAudit/
    storeAuditLayout.ts             # size constants
    storeAuditFormat.ts             # formatSigned / score helpers
    StoreAuditDialogTitle.tsx       # title + store picker + tooltips
    StoreAuditHero.tsx              # slope vs legacy chart region
    StoreAuditSandboxPanel.tsx      # Estimate accordion + pool + toast
```

Not shipped: `useStoreAuditSandbox` (D004 skipped), separate plan/actual table file
(table remains inside sandbox panel).

## Quality gates (every stage, from `web/`)

```powershell
cd web
npx tsc -b
npx eslint src tests --max-warnings 0
# (npm run lint may fail on local coverage/ — pre-existing; gate = eslint src tests)
npm run test:run
npx playwright test tests/e2e/planner.spec.ts
# optional: tests/e2e/tts-planner.spec.ts — record flake; do not weaken asserts
```

Backend / pytest is not required.

## Index

| ID   | Stage | Spec | Report | Status |
|------|-------|------|--------|--------|
| D000 | Baseline (before any code change) | [SPEC](./SPEC-D000-baseline.md) | [REPORT](./reports/REPORT-D000-baseline.md) | DONE |
| D001 | Constants + pure format | [SPEC](./SPEC-D001-constants-format.md) | [REPORT](./reports/REPORT-D001-constants-format.md) | DONE |
| D002 | Sandbox panel extract | [SPEC](./SPEC-D002-sandbox-panel.md) | [REPORT](./reports/REPORT-D002-sandbox-panel.md) | DONE |
| D003 | Hero + title chrome | [SPEC](./SPEC-D003-hero-title.md) | [REPORT](./reports/REPORT-D003-hero-title.md) | DONE |
| D004 | Sandbox state hook (optional) | [SPEC](./SPEC-D004-sandbox-hook.md) | [REPORT](./reports/REPORT-D004-sandbox-hook.md) | SKIPPED |
| D005 | Verification / handoff | [SPEC](./SPEC-D005-verification-handoff.md) | [REPORT](./reports/REPORT-D005-verification-handoff.md) | DONE |

## Section map (branch start — refined in D000 report)

| Block | Approx location | Candidate extract |
|-------|-----------------|-------------------|
| Layout constants | ~L65–76 | `storeAuditLayout.ts` ✅ D001 |
| Props / `InspectPanel` | ~L78–109 | stay near orchestrator |
| `formatSigned` + local score/bounds | ~L111–114, ~L175–188 | `storeAuditFormat.ts` ✅ D001 |
| Sandbox state + handlers | ~L193–298 | stayed on drawer (D004 skipped) |
| Dialog title chrome | ~L321–482 | `StoreAuditDialogTitle` ✅ D003 |
| Glance / boost / unreachable | ~L498–539 | already child components |
| Hero (slope vs legacy) | ~L540–578 | `StoreAuditHero` ✅ D003 |
| Sandbox Estimate overlay | ~L580–~835 | `StoreAuditSandboxPanel` ✅ D002 |
| Pool dialog + toast | ~L846–end | with sandbox panel ✅ D002 |

## Metrics (filled by reports)

| Moment | StoreAuditDrawer.tsx | StoreAuditDrawer.test.tsx | Notes |
|--------|----------------------|---------------------------|-------|
| Baseline (D000) | 931 | 331 | 389 unit tests; Playwright planner 1 passed; TTS e2e flake (strict `.or`) |
| After D001 | 928 | 331 | −3; `storeAudit/` layout+format (+tests); 395 unit tests |
| After D002 | 596 | 331 | −335 vs D000; `StoreAuditSandboxPanel` (448); 395 unit tests |
| After D003 | 397 | 331 | −534 vs D000; Hero (81) + DialogTitle (213); in ≤400–500 target; 395 unit tests |
| Final (D005) | **397** | 331 | D004 skipped; track complete; 395 unit tests; planner e2e green |

Line counts = physical lines in file (`(Get-Content path).Count`).

## Handoff (outside track)

See [REPORT-D005](./reports/REPORT-D005-verification-handoff.md): TTS Playwright
locator flake, `coverage/` eslintignore, scenario-store merge, optional
`useStoreAuditSandbox` later.
