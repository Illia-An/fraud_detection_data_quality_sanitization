# SPEC-T001 - Extract types and schedule helpers

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | T000 report green |
| Risk | Low (code moves, logic is not edited) |
| Report | `reports/REPORT-T001-extract.md` (written after the stage) |

## Goal

`planner.allocate` stops importing from `planner.five_percent`. Old import
paths keep working.

## Context

- `MonthScore`, `StoreProjection`, `trajectory_weights`, `add_calendar_months`
  are defined in `five_percent.py`; `Direction` is defined in `allocate.py`.
- `allocate.py` imports the first four from `five_percent`; `tts.py` imports
  the two classes from `five_percent` and lists them in `__all__`.
- `tests/test_planner_five_percent.py` imports `add_calendar_months` and
  `trajectory_weights` from `planner.five_percent`.

## In scope

1. `src/planner/plan_types.py` (new): `Direction`, `MonthScore`, `StoreProjection`.
   Definitions are moved verbatim (frozen dataclasses, same fields, same order).
2. `src/planner/schedule.py` (new): `trajectory_weights`, `add_calendar_months`.
   Bodies are moved verbatim.
3. `src/planner/five_percent.py`:
   - remove the moved definitions, import them from the new modules;
   - **re-export the old names** (`MonthScore`, `StoreProjection`,
     `trajectory_weights`, `add_calendar_months`) and add an `__all__` that also
     lists the module's own public names (`FivePercentPlanResult`,
     `plan_five_percent`), so the public surface does not shrink;
   - the lazy `allocate_plan` import stays in this stage.
4. `src/planner/allocate.py`: import from `plan_types` and `schedule` only;
   `Direction` is imported from `plan_types` (still importable as
   `planner.allocate.Direction`).
5. `src/planner/tts.py`: import `MonthScore`, `StoreProjection` from `plan_types`;
   keep `__all__` unchanged.
6. New test file `tests/test_planner_module_layout.py` with the identity check:
   - `planner.five_percent.MonthScore is planner.plan_types.MonthScore`
   - same for `StoreProjection`;
   - `planner.tts.MonthScore` / `StoreProjection` are the same objects;
   - `planner.five_percent.trajectory_weights is planner.schedule.trajectory_weights`
     and the same for `add_calendar_months`;
   - `planner.allocate.Direction is planner.plan_types.Direction`.

## Out of scope

- Removing the lazy imports (T002).
- The AST dependency guard (T002).
- Any edit to function bodies, signatures, defaults or numbers.
- `cumulative_slope`, `backend/`, existing tests (they must stay unchanged and pass).

## Acceptance

| Check | Command | Expected |
|-------|---------|----------|
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Focused tests | three planner test files + new layout test, `--no-cov -q` | all pass |
| Full tests | `uv run pytest -q` | all pass, same count as T000 plus new tests, coverage >= 80 % |
| Old imports | `from planner.five_percent import MonthScore, StoreProjection, trajectory_weights, add_calendar_months, plan_five_percent` | works (covered by existing tests + layout test) |
| Graph | `rg -n "from planner\.five_percent" src/planner/allocate.py` | no matches |
| Diff | `git diff` | moved blocks identical in content; no logic edits; existing tests untouched |

## Risks / rollback

- Risk: a public name silently disappears from `five_percent` once `__all__` is
  added. Mitigate: list the module's own public names in `__all__`; the layout
  test asserts the old names resolve.
- Risk: class `__module__` changes (`planner.five_percent` -> `planner.plan_types`).
  T000 checks for dependence on it (`pickle`, `__module__`); `repr` shows only
  the class name, so output does not change.
- Risk: Ruff has only `E9,F63,F7,F82` selected, so unused re-exports are not
  flagged; `__all__` makes the intent explicit anyway.
- Rollback: `git revert` of the stage commit.
