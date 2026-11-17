# SPEC-T000 - Baseline

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | - |
| Code change | none |
| Report | `reports/REPORT-T000-baseline.md` (written after the stage) |

## Goal

Record a verified "green before" state so T001 / T002 can be compared against it.

## In scope

- Run and record the Python quality gates on the clean branch.
- Record test counts and coverage.
- Record the exact import graph that the track will change.
- Check that nothing depends on the module path of the classes being moved.

## Out of scope

- Any source change.

## Steps

1. Confirm branch is `refactor/allocator-types`; note unrelated dirty files
   (expected: only `M .env.docker.example`).
2. `uv run ruff check src backend db tests`
3. `uv run mypy src/planner`
4. `uv run pytest tests/test_planner_five_percent.py tests/test_planner_tts.py tests/test_wave8_maintainability.py --no-cov -q`
5. `uv run pytest -q` (record passed / failed / skipped, total coverage; floor is 80 %).
6. Record the current import graph:
   - `rg -n "from planner\.(five_percent|tts|allocate)" src backend tests scripts db`
   - `rg -n "planner\.allocate" src` (lazy imports)
7. Check for dependence on class module paths:
   `rg -n "pickle|__module__|__qualname__" src backend tests -g "*.py"`
   (expected: no matches; if there are any, T001 must account for them).
8. Check mypy re-export strictness in `pyproject.toml` (`[tool.mypy]`): confirm
   there is no `strict` / `no_implicit_reexport`.
9. Write REPORT-T000.

## Acceptance

| Check | Command | Expected |
|-------|---------|----------|
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Focused tests | the three planner test files, `--no-cov -q` | all pass |
| Full tests | `uv run pytest -q` | all pass, coverage >= 80 % |
| Import graph | `rg` as above | recorded in REPORT-T000 |
| Module-path check | `rg` as above | recorded; no blocking dependence |

If any check is red at baseline, the failure is recorded as **pre-existing** and
is not fixed in this track unless the user decides otherwise.

## Risks / rollback

None: no code changes.
