# SPEC-M002 — Planning year UX

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M001 |
| Meeting items | 5, 6 |
| Report | `reports/REPORT-M002-planning-year-ux.md` |

## Goal

User selects a **planning year**. Mandatory **reference-month** as the planning
anchor is removed (or demoted). Cumulative planning runs from year start /
last available fact through **December of the selected year**.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M002-1 | Primary control: **Planning year** (integer). Horizon end = Dec of that year. |
| D-M002-2 | Cutover / as-of for Slope Plan = **last available cleansed fact** on or before Dec(planning_year), not a user-picked reference month. |
| D-M002-3 | Remove mandatory Reference month from the default Planner controls. If kept for diagnostics, hide under Advanced and do not block Run. |
| D-M002-4 | Replace hardcoded `cumulative_start: { year: 2025, month: 1 }` in Save/Sim payloads with `{ planning_year, month: 1 }` (or first fact ≥ Jan of planning year — record choice in REPORT). |
| D-M002-5 | Legacy `POST /plans` equal-mean Run may still need a baseline month internally; derive it from last fact / Dec prior, not from a required UI field. |

## In scope

- Controls rail: year picker; Run/Save/Sim payload alignment.
- Slope / monitoring as-of defaults from last fact.
- Tests + i18n.
- Update e2e Planner smoke selectors if labels change.

## Out of scope

- Historical seasonal monthly distribution (M006).
- Multi-year concurrent plans.

## Steps

1. Map all `reference_year` / `reference_month` / `cumulative_start` call sites on Survey Planner.
2. Implement planning-year state + derived as-of / cumulative_start.
3. Demote or remove reference-month UI; keep Advanced only if needed for debug.
4. Verify Slope path: last fact → Dec(planning_year).
5. Tests + REPORT-M002.

## Acceptance

| Check | Expected |
|-------|----------|
| User can Run without choosing a reference month | yes |
| Save/Sim use planning_year-consistent cumulative_start | yes |
| Slope horizon ends Dec(planning_year) | chart + unit test |
| Focused tests + lint/build | pass |

## Risks / rollback

- Breaking TTS Planner if shared hooks change — Survey-only; leave TTS reference UX unless shared helper is dual-mode.
- Rollback: restore reference controls and 2025-01 hardcode.
