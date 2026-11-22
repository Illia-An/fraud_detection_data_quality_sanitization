# SPEC-M005 — Deviations surface

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M004 |
| Meeting items | 11, 12, 16, 17, 18 |
| Report | `reports/REPORT-M005-deviations-surface.md` |

## Goal

Show **actual / plan / cumulative / deviation** per period in a coherent
surface; expose month×store targets; simplify status copy; align month labels
with Slope charts.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M005-1 | Mount (or rebuild) a network **targets matrix** (store × month) — prefer wiring existing `ProjectionHeatmap` if still viable. |
| D-M005-2 | Render period deviations using monitoring `insights.months` (or equivalent) — not chart-only. |
| D-M005-3 | Single display format for months across tables and charts (reuse `slopeAxisFormat` helpers or shared formatter). |
| D-M005-4 | Simplify glance / At-risk copy: fewer competing numbers; short status sentences (consequences deferred to M008 detail). |
| D-M005-5 | Prefer progressive disclosure (collapsed matrix / period table) so Slope viewport stays primary. |

## In scope

- Network matrix + period deviation table.
- Month label alignment.
- Copy cleanup on strip / At-risk headers.
- Tests + e2e smoke for new testids.

## Out of scope

- Network gap → stores×months drill (M007).
- Full recommendation engine (M008).

## Steps

1. Inventory orphan `ProjectionHeatmap` / `PlanActualLens` / `insights.months`.
2. Mount period + matrix under At-risk or a disclosure on screen 2.
3. Share month formatter with Slope.
4. Trim dense labels; i18n.
5. Tests + REPORT-M005.

## Acceptance

| Check | Expected |
|-------|----------|
| User sees fact, plan, Δ for periods without opening Inspect | yes |
| Month labels match chart style | yes |
| Matrix available for store×month plan scores | yes |
| Tests pass | yes |

## Risks / rollback

- Viewport clutter — keep behind disclosure / second screen.
- Rollback: unmount tables; charts remain.
