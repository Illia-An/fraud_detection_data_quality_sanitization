# SPEC-M003 — Re-sim after new facts

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | M002 |
| Meeting items | 15, 18 |
| Report | `reports/REPORT-M003-resim-after-facts.md` |

## Goal

When the cleansed panel gains new actual months (or Refresh brings them),
Planner **recalculates** network monthly plans and per-restaurant paths so
Simulation / Slope stay consistent with the active baseline version.

## Locked decisions

| ID | Decision |
|----|----------|
| D-M003-1 | Trigger: after successful panel refresh (M001) and/or explicit **Re-simulate**; also after Save when facts changed. |
| D-M003-2 | Re-sim calls existing `POST /simulation` (cumulative_slope) with current facts + `active_plan_version_id` when set. |
| D-M003-3 | Baseline Plan version remains frozen; Simulation updates live (SPEC-P001 D-07/D-08). |
| D-M003-4 | Sandbox Estimate Apply may patch draft locally; network re-sim remains the source of truth for Slope after facts advance. |

## In scope

- Wire re-sim on refresh / fact advance; clear implied adjustments on fresh sim (already partially done).
- UX feedback: pending / success / failure on re-sim.
- Tests for “new month in panel → sim spine advances”.

## Out of scope

- Auto background polling of MSSQL.
- TTS simulation.

## Steps

1. Define fact-fingerprint (e.g. max period + row count) on panel.
2. On fingerprint change → enqueue simulation refresh.
3. Ensure store monthly + network layers update together via existing response.
4. Tests + REPORT-M003.

## Acceptance

| Check | Expected |
|-------|----------|
| New fact month visible in Slope after re-sim | yes |
| Active plan version id preserved when present | yes |
| Focused tests pass | yes |

## Risks / rollback

- Re-sim thrash on every keystroke — debounce / only on Refresh or fingerprint change.
- Rollback: remove auto trigger; keep manual Run/Save refresh only.
