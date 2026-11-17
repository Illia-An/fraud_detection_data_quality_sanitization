# REPORT-T000 - Baseline

| Field | Value |
|-------|-------|
| Spec | [SPEC-T000-baseline.md](../SPEC-T000-baseline.md) |
| Result | GREEN (no pre-existing failures) |
| Code change | none |

## Environment

- Branch: `refactor/allocator-types` (`git branch --show-current`).
- `git status --short`: ` M .env.docker.example` (unrelated, not part of the track),
  `?? docs/planner-allocator-types/` (track docs).
- `git worktree list`: besides the main tree, a leftover worktree from the previous
  track exists: `C:/McDonalds/01_SOURCES(clean_code)/_wt_head_s005` (detached HEAD
  `b4ef30b`). Not touched.

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | `All checks passed!`, exit 0 |
| Mypy | `uv run mypy src/planner` | `Success: no issues found in 17 source files`, exit 0 |
| Focused tests | `uv run pytest tests/test_planner_five_percent.py tests/test_planner_tts.py tests/test_wave8_maintainability.py --no-cov -q` | 16 passed, 1 warning, exit 0 |
| Full tests | `uv run pytest -q` | **228 passed**, 0 failed, 0 skipped, 1 warning; total coverage **89.35 %** (floor 80 %), exit 0 |

The warning is `StarletteDeprecationWarning` (httpx vs `starlette.testclient`), unrelated.

Per-file coverage at baseline (for later comparison): `allocate.py` 83 %
(120 stmts, 20 missed), `five_percent.py` 86 % (43 stmts, 6 missed).

## Import graph

`rg -n "from planner\.(five_percent|tts|allocate)" src backend tests scripts db`
(only planner-relevant lines):

| File:line | Import |
|-----------|--------|
| `src/planner/allocate.py:12` | `from planner.five_percent import (MonthScore, StoreProjection, add_calendar_months, trajectory_weights)` |
| `src/planner/tts.py:10` | `from planner.five_percent import MonthScore, StoreProjection` |
| `src/planner/tts.py:55` | `from planner.allocate import allocate_plan` (lazy, inside `plan_tts`) |
| `src/planner/five_percent.py:85` | `from planner.allocate import allocate_plan` (lazy, inside `plan_five_percent`) |
| `backend/routers/plans.py:35-36` | `plan_five_percent`, `plan_tts` |
| `tests/test_wave8_maintainability.py:19-20` | `plan_five_percent`, `plan_tts` |
| `tests/test_planner_five_percent.py:7` | `add_calendar_months`, `plan_five_percent`, `trajectory_weights` from `planner.five_percent` |
| `tests/test_planner_tts.py:7` | `plan_tts` |

(Other matches are `planner.tts_bounds`, `planner.tts_baseline`, `planner.tts_kpi_ap`
- different modules, not affected.)

`rg -n "planner\.allocate" src`: only the two lazy imports
(`tts.py:55`, `five_percent.py:85`) plus docstring mentions.

No other module imports `planner.allocate`, and nothing outside `tests/`,
`backend/routers/plans.py` and `tts.py` imports `MonthScore` / `StoreProjection`
via `five_percent`.

## Module-path dependence

`rg -n "pickle|__module__|__qualname__" src backend tests -g "*.py"`: **no matches**
(exit 1). Nothing depends on the `__module__` of the classes that will move.

## Mypy configuration

`[tool.mypy]` in `pyproject.toml`: `python_version = "3.12"`,
`ignore_missing_imports = true`, `follow_imports = "silent"`,
`files = ["src/planner"]`. No `strict`, no `no_implicit_reexport`.
Ruff selects only `E9,F63,F7,F82`, so unused re-exports are not flagged.

## Metrics for README

- pytest passed at baseline: 228
- `allocate.py` imports from `five_percent`: 4 names
- lazy `allocate_plan` imports: 2

## Conclusion

Baseline is green; nothing to record as pre-existing. T001 may start.
