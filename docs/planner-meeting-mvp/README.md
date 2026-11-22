# Track: Planner Meeting MVP (M-series)

**Branch (intended):** `feat/planner-meeting-mvp`  
**Tag baseline:** `v1.42.0-planner-inspect-ux` (or current `main` after #47)  
**Source:** meeting backlog items **3–18** (Survey Planner only)

## Goal

Close the operational planning loop: cleansed data → planning year → save/compare
versions → deviations → re-sim after facts → (later) historical allocate,
network-gap drill-down, EOY recommendations.

## Build order

| Order | SPEC | Meeting items | Priority |
|-------|------|---------------|----------|
| 0 | [M000](./SPEC-M000-baseline.md) | — | Gate |
| 1 | [M001](./SPEC-M001-fresh-cleansed-slice.md) | 3, 4, 18 | P0 |
| 2 | [M002](./SPEC-M002-planning-year-ux.md) | 5, 6 | P0 |
| 3 | [M003](./SPEC-M003-resim-after-facts.md) | 15, 18 | P0 |
| 4 | [M004](./SPEC-M004-plan-versions-ui.md) | 10, 18 | P0 |
| 5 | [M005](./SPEC-M005-deviations-surface.md) | 11, 12, 16, 17, 18 | P0 |
| 6 | [M006](./SPEC-M006-historical-allocation.md) | 7, 8, 9 | P1 |
| 7 | [M007](./SPEC-M007-network-gap-attribution.md) | 13 | P1 |
| 8 | [M008](./SPEC-M008-eoy-recommendations.md) | 14, 16 | P1 |

## Workflow

1. Implement **one** SPEC at a time (minimal diff).
2. Run acceptance commands listed in that SPEC.
3. Write **`reports/REPORT-M00N-….md`** (GREEN/YELLOW/RED + evidence).
4. Mark SPEC Status → DONE; link the report.
5. Only then start the next SPEC.

## Reports

After each SPEC: create `reports/REPORT-M00N-<slug>.md` using the template in
[`reports/README.md`](./reports/README.md).

## Non-goals (whole track)

- TTS Planner parity
- Volume-weighted network mean
- Write-back to MSSQL `TargetsByMetrics`
- Restoring Slope point-drag UI

## Related contracts

- [`../contracts/sanitized_panel_handoff.md`](../contracts/sanitized_panel_handoff.md)
- [`../contracts/slope_plan_cum_to_target.md`](../contracts/slope_plan_cum_to_target.md)
