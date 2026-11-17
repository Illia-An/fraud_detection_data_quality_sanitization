# SPEC-R000 - Baseline

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | - |
| Code change | none |
| Report | `reports/REPORT-R000-baseline.md` (written after the stage) |

## Goal

Record a verified green baseline and the exact import graph before any rename.

## In scope

1. Confirm branch `refactor/tier-rename`; note unrelated dirty files.
2. `uv run ruff check src backend db tests`
3. `uv run mypy src/planner`
4. Focused tests: `test_tier1`, `test_tier2`, `test_tier3`, `test_wave8_maintainability` (`--no-cov -q`).
5. Full `uv run pytest -q` (passed / failed / skipped, coverage).
6. Import inventory:
   - `rg -n "from fraud_guard\.(tier1|tier2|tier3|pipeline_steps)" src backend tests scripts`
   - list public symbols in each of `tier1.py` / `tier2.py` / `tier3.py`
7. Confirm Wave 8 aliases already exist in `pipeline_steps.py`.
8. Write REPORT-R000.

## Out of scope

- Any source change.

## Acceptance

| Check | Expected |
|-------|----------|
| Ruff / mypy / focused / full pytest | green, or red recorded as **pre-existing** |
| Import graph | recorded in the report |
| Naming decision | matches README target structure (locked) |

## Risks / rollback

None: no code changes.
