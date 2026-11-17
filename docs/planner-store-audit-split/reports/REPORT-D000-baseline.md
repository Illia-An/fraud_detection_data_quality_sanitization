# REPORT-D000 - Baseline

| Field | Value |
|-------|-------|
| Spec | [SPEC-D000-baseline.md](../SPEC-D000-baseline.md) |
| Result | GREEN (TTS Playwright flake pre-existing — recorded, asserts unchanged) |
| Code change | none (track docs only) |

## Environment

- Branch: `refactor/store-audit-drawer-split`
- HEAD: `288edfd` (Merge pull request #44 — FE planner cleanliness)
- `git status --short` (before docs): ` M .env.docker.example` (unrelated; not part of this track)
- Tag present: `v1.39.0-fe-planner-cleanliness`

## Line counts (physical lines = `(Get-Content path).Count`)

| File | Lines |
|------|-------|
| `web/src/components/planner/StoreAuditDrawer.tsx` | **931** |
| `web/src/components/planner/StoreAuditDrawer.test.tsx` | **331** |

No `storeAudit/` folder yet (created in D001+).

## Public API / page wiring

- Single export: `StoreAuditDrawer` (~L120).
- `PlannerPage.tsx` (~L1285): passes slope / unreachable / boost + full processResult.
- `TtsPlannerPage.tsx` (~L943): simplified props + `yAxisTitle` / `tickSuffix`,
  `processResult={null}` (no slope/unreachable/boost).

Already extracted children (reuse, do not re-home in this track unless needed):
`InspectStoreGlance`, `CumulativeSlopeHeroChart`, `StoreHeroEvaluationChart`,
`UnreachableRecommendationCard`.

## Section inventory (`StoreAuditDrawer.tsx`)

| Block | Lines (approx) | Notes for D001+ |
|-------|----------------|-----------------|
| Imports | 1–63 | — |
| Layout constants | 65–76 | `INSPECT_DIALOG_PAPER_MAX_PX`, sandbox overlay sizes, hero min heights → `storeAuditLayout.ts` |
| `InspectPanel` + `StoreAuditDrawerProps` | 78–109 | keep with orchestrator |
| `formatSigned` | 111–114 | → `storeAuditFormat.ts` |
| Derived scoreDigits / floor / ceiling / `formatScore` / bounds | 175–188 | pure wrappers candidate for format module |
| Sandbox `useState` | 193–202 | D004 hook |
| Reset-on-open `useEffect` | 204–213 | D004 |
| `baseTable` / `displayTable` / `editableCol` | 215–225 | stay near panel or hook |
| Handlers: recalculate / clear / apply / reset | 227–298 | D004 |
| Main `Dialog` paper + sizes | 302–320 | uses layout constants |
| `DialogTitle` chrome (picker, chip, tooltips, close) | 321–482 | `StoreAuditDialogTitle` (D003) |
| Glance + boost Alert + unreachable card | 498–539 | already components |
| Hero region (slope vs legacy) | 540–578 | `StoreAuditHero` (D003) |
| Sandbox overlay Accordion + Estimate table + actions | 580–837 | `StoreAuditSandboxPanel` (+ optional table) (D002) |
| `DialogActions` Close | 840–844 | orchestrator |
| Pool nested `Dialog` | 846–911 | with sandbox panel |
| Apply `Snackbar` | 913–928 | with sandbox panel / hook |

## Checks (all actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | **exit 0** |
| Lint (source) | `npx eslint src tests --max-warnings 0` | **exit 0** |
| Unit | `npm run test:run` | **88 files / 389 tests passed**, ~64s |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **1 passed** (~18s) |
| Playwright TTS (optional) | `npx playwright test tests/e2e/tts-planner.spec.ts` | **1 failed** — pre-existing strict-mode flake |

`npm warn Unknown env config "devdir"` appears throughout — user npmrc, unrelated.

### TTS Playwright flake (pre-existing, not fixed)

`tts-planner.spec.ts` ~L27: locator
`.or(tts-allocation-levers | tts-planner-ap-failed | tts-planner-loading-ap)`
resolved to **2** elements (`tts-planner-loading-ap` and `tts-allocation-levers`
both visible) → Playwright strict mode violation. Asserts **not** weakened.
Follow-up outside this track.

### Lint caveat (pre-existing)

Same as F000/S000: local `web/coverage/` can break `npm run lint`. Gate for this
track remains `npx eslint src tests --max-warnings 0`.

## Metrics for README

- StoreAuditDrawer.tsx: **931**
- StoreAuditDrawer.test.tsx: **331**
- Unit: 389 passed / 88 files
- Playwright planner: 1 passed
- Playwright TTS: 1 failed (pre-existing flake)

## Conclusion

Baseline is usable. Ready for **D001** (constants + pure format) after user **go**.
Commit of track docs only when the user asks.
