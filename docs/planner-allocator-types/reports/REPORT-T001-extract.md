# REPORT-T001 - Extract types and schedule helpers

| Field | Value |
|-------|-------|
| Spec | [SPEC-T001-extract.md](../SPEC-T001-extract.md) |
| Result | GREEN |
| Baseline | [REPORT-T000](./REPORT-T000-baseline.md) |

## What changed

| File | Change |
|------|--------|
| `src/planner/plan_types.py` | new: `Direction`, `MonthScore`, `StoreProjection` (moved verbatim, frozen dataclasses, same fields) |
| `src/planner/schedule.py` | new: `trajectory_weights`, `add_calendar_months` (bodies moved verbatim) |
| `src/planner/five_percent.py` | removed the moved definitions; imports them from the new modules; added `__all__` (`FivePercentPlanResult`, `MonthScore`, `StoreProjection`, `add_calendar_months`, `plan_five_percent`, `trajectory_weights`). Lazy `allocate_plan` import left as is (T002) |
| `src/planner/allocate.py` | imports only from `planner.plan_types` and `planner.schedule`; `Direction` definition removed (still available as `planner.allocate.Direction`); `Literal` import removed (no longer used) |
| `src/planner/tts.py` | `MonthScore`, `StoreProjection` now imported from `planner.plan_types`; `__all__` unchanged |
| `tests/test_planner_module_layout.py` | new, 5 tests (identity checks + `__all__` of `five_percent`) |

Existing tests were not modified. No logic, signature, default or number was edited.

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | `All checks passed!`, exit 0 |
| Mypy | `uv run mypy src/planner` | `Success: no issues found in 19 source files`, exit 0 |
| Focused tests | three planner test files + `tests/test_planner_module_layout.py`, `--no-cov -q` | 21 passed (16 baseline + 5 new), exit 0 |
| Full tests | `uv run pytest -q` | **233 passed** (228 baseline + 5 new), 0 failed, 0 skipped; coverage **89.36 %** (floor 80 %), exit 0 |
| Graph | `rg -n "from planner\.five_percent" src/planner/allocate.py` | no matches (rg exit 1) |

Coverage note: `schedule.py` is listed at 65 % (17 stmts, 6 missed: lines 12, 16-21,
the `ValueError` branch and the `front_loaded` / `accelerated` modes). At baseline the
same 6 statements were missed inside `five_percent.py` (43 stmts, 6 missed, 86 %), so
this is not new uncovered code. `allocate.py` stays at 83 %; total 89.35 % -> 89.36 %.
`plan_types.py` and `five_percent.py` are fully covered (not shown in the table).

## Notes

- `git status --short` after the stage: modified `allocate.py`, `five_percent.py`,
  `tts.py`; new `plan_types.py`, `schedule.py`, `tests/test_planner_module_layout.py`,
  docs. `.env.docker.example` is still modified and is not part of the track.
- Nothing committed.
- `__module__` of the moved classes changed to `planner.plan_types`; T000 found no
  dependence on it (`pickle|__module__|__qualname__`: no matches).

## Metrics

- pytest passed: 228 -> 233
- `allocate.py` imports from `five_percent`: 4 names -> 0
- lazy `allocate_plan` imports: 2 -> 2 (T002)

## Next

T002 (remove lazy imports + AST dependency guard) - only after user "go".
