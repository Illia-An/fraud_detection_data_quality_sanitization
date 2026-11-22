# SPEC-M004 — Plan versions UI + compare

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M003 |
| Meeting items | 10, 18 |
| Report | `reports/REPORT-M004-plan-versions-ui.md` |

## Goal

Users can **list**, **open**, and **compare** immutable plan versions (original
vs updated) already stored in SQLite `PlanStore`, without leaving Planner.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M004-1 | Use existing `GET /plan-versions` and `GET /plan-versions/{id}` (hook them in FE). |
| D-M004-2 | Save continues to append-only insert; never mutate prior versions. |
| D-M004-3 | Compare MVP: side-by-side or stacked summary — network target, as-of, store_count, and month×store matrix delta for selected pair (baseline vs selected). |
| D-M004-4 | “Original” = oldest version for planning_year (or user-pinned); “Updated” = active / latest — labels in UI. |

## In scope

- FE hooks + controls: version list, set active, open compare.
- Minimal compare view (table or summary chips).
- Tests for list/compare empty and two-version cases.

## Out of scope

- Full journal Excel sheets (P001 D-09 context is enough).
- MSSQL TargetsByMetrics sync.

## Steps

1. Add API hooks for list/get if missing.
2. UI in controls footer or disclosure: Versions.
3. Compare panel for two selected ids.
4. Tests + REPORT-M004.

## Acceptance

| Check | Expected |
|-------|----------|
| After two Saves, user sees ≥2 versions | yes |
| Compare shows at least network-level diff | yes |
| Active version drives subsequent simulation | yes |
| Tests / lint / build | pass |

## Risks / rollback

- Large payloads in list — use list items meta; fetch full payload on open.
- Rollback: hide UI; Keep Save API as today.
