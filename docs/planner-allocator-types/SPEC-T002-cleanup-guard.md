# SPEC-T002 - Remove lazy imports and add a dependency guard

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | T001 report green |
| Risk | Low |
| Report | `reports/REPORT-T002-cleanup-guard.md` (written after the stage) |

## Goal

Make the dependency direction permanent: callers depend on the core, never the
other way round. Remove the workaround that existed only because of the cycle.

## Context

After T001 `allocate.py` no longer imports `five_percent`, so there is no cycle.
The function-level imports in `plan_five_percent` (`five_percent.py:85`) and
`plan_tts` (`tts.py:55`) are no longer needed.

## In scope

1. `src/planner/five_percent.py`: move `from planner.allocate import allocate_plan`
   to the top of the file.
2. `src/planner/tts.py`: same.
3. Dependency guard test (extend `tests/test_planner_module_layout.py`):
   - using `ast`, parse `allocate.py`, `plan_types.py`, `schedule.py` and assert
     none of them imports `planner.five_percent` or `planner.tts`
     (both `import x` and `from x import y` forms, absolute and relative);
   - assert `plan_types.py` and `schedule.py` do not import `planner.allocate`
     either (they are leaves);
   - assert `five_percent.py` and `tts.py` have **no** import of `planner.allocate`
     inside function bodies (top-level only).
4. Import order check: `uv run python -c "import planner.allocate"` and
   `import planner.five_percent` / `import planner.tts` each work in a fresh
   interpreter (no cycle, any import order).

## Out of scope

- Merging the three result dataclasses.
- Any change to numbers, signatures or behavior.
- `cumulative_slope`.

## Acceptance

| Check | Command | Expected |
|-------|---------|----------|
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Guard | `uv run pytest tests/test_planner_module_layout.py --no-cov -q` | pass |
| Focused tests | three planner test files, `--no-cov -q` | all pass |
| Full tests | `uv run pytest -q` | all pass, coverage >= 80 % |
| Fresh imports | three `uv run python -c "import planner.<module>"` | exit 0 each |
| Lazy imports | `rg -n "^\s+from planner\.allocate" src` | no matches |
| Sanity of the guard | temporarily add `from planner.five_percent import MonthScore` to `allocate.py`, run the guard, revert | guard fails, then passes after revert (recorded in the report) |

## Risks / rollback

- Risk: an import cycle appears from a path not covered by tests. Mitigate: the
  fresh-interpreter import checks in each order, and the full test suite.
- Risk: guard too strict or brittle. Mitigate: parse with `ast`, no text grep;
  it only checks the stated modules.
- Rollback: `git revert` of the stage commit (T001 stays valid on its own).
