# SPEC-M001 — Fresh cleansed slice

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M000 |
| Meeting items | 3, 4, 18 |
| Report | `reports/REPORT-M001-fresh-cleansed-slice.md` |

## Goal

Planner uses **only** the cleansed Sanitization panel and can **refresh** to the
latest successful process slice (button and/or auto-invalidate), so planning
facts stay aligned with the source cleansed table.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M001-1 | Facts for Run / Save / Simulation come only from `buildSanitizedPanelFromProcess` (cleansed `store_impact_series`). No raw MSSQL paths in Planner. |
| D-M001-2 | Planner exposes an explicit **Refresh panel** (or equivalent) that re-reads the latest in-session `processResult` / triggers documented re-process handoff — not a silent stale panel. |
| D-M001-3 | If panel is missing or stale after Sanitization re-run, Planner shows empty/blocked Run with clear copy (no inventing facts). |
| D-M001-4 | Enterprise write-back and automated “row-hash equals source” audit are **out of scope**; optional lightweight parity note in UI (row count / period range) is enough for MVP. |

## In scope

- UX + wiring: refresh / invalidate cleansed panel into Planner session.
- Guards: block Run/Save/Sim when panel absent.
- Tests: refresh path + blocked state.
- i18n EN/HE for new copy.

## Out of scope

- Snapshot scheduler / cron (ops runbook already covers snapshot refresh).
- Changing Sanitization tier rules.
- TTS panel handoff.

## Steps

1. Inventory current handoff (`processResult` → panel → `panelToSimulationFacts`).
2. Add Refresh control on Planner (controls rail or strip) + empty/stale messaging.
3. Ensure Run / Save / Sim still use only cleansed facts.
4. Unit + focused e2e assertion that Planner sees updated panel after Sanitization re-run → Refresh (or auto path if chosen).
5. Write REPORT-M001.

## Acceptance

| Check | Expected |
|-------|----------|
| No Planner path invents scores outside cleansed panel | code + test |
| User can obtain a fresh slice without leaving the product story | Refresh or documented auto-invalidate |
| `cd web && npm run test:run` (focused + relevant) | pass |
| Lint / build on touched files | pass |

## Risks / rollback

- Auto-invalidate may clear draft mid-edit → prefer explicit Refresh or confirm dialog.
- Rollback: revert M001 commit(s); session continues to use previous handoff-only behaviour.
