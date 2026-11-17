# REPORT-F003 - Export / save chrome

| Field | Value |
|-------|-------|
| Spec | [SPEC-F003-export-chrome.md](../SPEC-F003-export-chrome.md) |
| Result | GREEN |
| Previous | [REPORT-F002](./REPORT-F002-goal-drafts.md) |

## What changed

| File | Change |
|------|--------|
| `web/src/components/planner/plannerCsv.ts` | added `downloadBlobFile`; text download uses it |
| `web/src/components/planner/usePlannerExcelExport.ts` | new: busy/error state + `exportExcel` + `canExportPlanExcel` |
| `web/src/components/planner/usePlannerExcelExport.test.ts` | new (2 tests) |
| `PlannerPage.tsx` / `TtsPlannerPage.tsx` | use the hook; Excel request builders stay on the page |

**Save-plan** chrome stays on `PlannerPage` only (TTS has no twin). Not extracted.

Filenames unchanged: `sanitization-plan-report.xlsx` / `tts-plan-report.xlsx`.

## Line counts

| File | F000 | F002 | F003 | Δ vs F000 |
|------|------|------|------|-----------|
| PlannerPage.tsx | 1406 | 1327 | **1316** | −90 |
| TtsPlannerPage.tsx | 1061 | 976 | **965** | −96 |

## Checks (from `web/`, actually run)

| Check | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc -b` | exit 0 |
| Lint | `npx eslint src tests --max-warnings 0` | exit 0 |
| Full unit | `npm run test:run` | **88 files / 389 tests**, exit 0 |
| Playwright planner | `npx playwright test tests/e2e/planner.spec.ts` | **passed** |

TTS Playwright not re-run this stage (same known strict-mode flake as F001/F002).

## Track status

F000–F003 **DONE**. Nothing committed. Next: user asks for commit / PR / merge / tag.
Handoff: recommended next track = **StoreAuditDrawer split**.
