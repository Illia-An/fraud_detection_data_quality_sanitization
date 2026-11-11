# REPORT-P001 — Target & Simulation Planning (Phases 0–5)

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-P001](./SPEC-P001-target-simulation-planning.md) |
| **Branch** | `feat/planner-target-simulation` |
| **Status** | Phases 0–5 landed on branch (Survey MVP) |

## Delivered

| Phase | Outcome |
|-------|---------|
| 0 | SPEC + domain + API contracts |
| 1 | `src/planner/cumulative_slope/` engine + unit tests |
| 2 | SQLite `PlanStore` + `/plan-versions` + `/simulation` (+ adjust) |
| 3 | FE layers, Save Plan vs Export Excel, toggles, unreachable chip |
| 4 | Excel `StoreMatrix` M1–12 + version context on Summary |
| 5 | Handoff supersession, [RUNBOOK-plan-store.md](./RUNBOOK-plan-store.md), Compose `:rw` volume, restart smoke test, e2e hero/Save Plan asserts |

## Explicit follow-ups (not blocking this branch)

- TTS port of cumulative-slope (D-01 later stage).
- Default cutover: drop legacy `/plans` heuristic UI path (keep API opt-in).
- Playwright full Save→restart→overlay journey against a live plan store (ops checklist in runbook covers Compose).
- O-03 planning-year edge when as-of crosses calendar year.

## Verify

```powershell
uv run --no-sync python -m pytest tests/test_planner_cumulative_slope.py tests/test_plan_store.py tests/test_cumulative_plan_api.py tests/test_excel_report.py -q
cd web; npm test -- --run src/schemas/excelReport.test.ts src/components/planner/cumulativeSlopeLayers.test.ts
```
