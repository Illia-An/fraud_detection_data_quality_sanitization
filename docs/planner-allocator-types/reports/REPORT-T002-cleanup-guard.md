# REPORT-T002 - Remove lazy imports and add a dependency guard

| Field | Value |
|-------|-------|
| Spec | [SPEC-T002-cleanup-guard.md](../SPEC-T002-cleanup-guard.md) |
| Result | GREEN |
| Previous | [REPORT-T001](./REPORT-T001-extract.md) |

## What changed

| File | Change |
|------|--------|
| `src/planner/five_percent.py` | `from planner.allocate import allocate_plan` moved to the top of the file; function-level import removed |
| `src/planner/tts.py` | same |
| `tests/test_planner_module_layout.py` | extended with an `ast`-based dependency guard (7 new test cases: 12 total) |

No numbers, signatures or behavior changed. Existing tests were not modified.

## Guard (in `tests/test_planner_module_layout.py`)

Parses the source files with `ast` (no text grep). `_imported_modules` handles
`import x`, `from x import y`, `from planner import y` (reported as `planner.y`)
and relative forms (`from . import y`, `from .x import y`).

- `allocate`, `plan_types`, `schedule` must not import `planner.five_percent` /
  `planner.tts` (3 cases).
- `plan_types`, `schedule` must not import `planner.allocate` (2 cases).
- `five_percent`, `tts` must import `planner.allocate`, and **not** inside any
  function body (2 cases).

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | `All checks passed!`, exit 0 |
| Mypy | `uv run mypy src/planner` | `Success: no issues found in 19 source files`, exit 0 |
| Guard | `uv run pytest tests/test_planner_module_layout.py --no-cov -q` | 12 passed |
| Focused tests | three planner test files, `--no-cov -q` | 16 passed |
| Full tests | `uv run pytest -q` | **240 passed** (233 + 7 new), 0 failed, 0 skipped; coverage **89.36 %**, exit 0 |
| Fresh imports | `uv run python -c "import planner.<m>"` for `allocate`, `five_percent`, `tts`, `plan_types`, `schedule` | each prints `ok`, exit 0 |
| Lazy imports | `rg -n "^\s+from planner\.allocate" src` | no matches (rg exit 1) |

## Sanity of the guard (temporary edits, all reverted)

| Case | Temporary edit | Result |
|------|----------------|--------|
| 1 | top-level `from planner.five_percent import MonthScore` in `allocate.py` | pytest fails at **collection**: `ImportError ... circular import` (the real cycle is caught before the AST guard runs) |
| 2 | top-level `from . import tts` in `allocate.py` | same `ImportError` at collection |
| A | `from planner.five_percent import MonthScore` inside a function in `allocate.py` (does not break import) | guard fails: `test_core_and_leaves_do_not_import_callers[allocate]`, 1 failed / 11 passed |
| B | `from . import tts` inside a function in `allocate.py` (relative form) | guard fails: same test, 1 failed / 11 passed |
| C | `import planner.allocate` inside a function in `schedule.py` | guard fails: `test_leaf_modules_do_not_import_allocate[schedule]` |
| 3 | lazy `from planner.allocate import allocate_plan` put back into `plan_tts` | guard fails: `test_callers_import_allocate_at_top_level_only[tts]` |

After every case the files were restored; the guard is green again (12 passed)
and `git diff` of `allocate.py` / `tts.py` shows only the intended stage changes.

Cases 1-2 show the cycle is now impossible at module level even without the guard;
cases A-C show the guard itself detects forbidden edges that do not break imports
(function-level, relative, leaf rule).

## Metrics

- pytest passed: 228 (baseline) -> 233 (T001) -> 240 (T002)
- `allocate.py` imports from `five_percent`: 0
- lazy `allocate_plan` imports: 2 -> 0

## Track status

T000, T001, T002 done. Nothing committed; `.env.docker.example` remains modified and
is not part of the track.
