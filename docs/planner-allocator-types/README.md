# Planner Allocator Types (SDD)

Break the dependency of the shared allocator core `planner.allocate` on one of its
callers, `planner.five_percent`. Origin: independent architecture review (task 2).

## Problem

`src/planner/allocate.py` is the shared core for `plan_five_percent` (higher is
better) and `plan_tts` (lower is better), but it imports from one of them:

```python
from planner.five_percent import (
    MonthScore, StoreProjection, add_calendar_months, trajectory_weights,
)
```

Consequences:

- `five_percent.py` and `tts.py` must import `allocate_plan` **lazily inside the
  function** (`five_percent.py:85`, `tts.py:55`) to avoid a circular import.
- `tts.py` imports `MonthScore` / `StoreProjection` from the sibling `five_percent`
  and re-exports them.
- Moving only the two dataclasses is not enough: the two helper functions
  (`trajectory_weights`, `add_calendar_months`) must move as well.

## Goal

- The shared core depends only on neutral modules (types + schedule helpers).
- `five_percent.py` and `tts.py` import `allocate_plan` at the top of the file.
- **No behavior or number change.** Code moves, logic is not edited.
- All old import paths keep working.

## Target structure

```
src/planner/
├── plan_types.py   # new: Direction, MonthScore, StoreProjection
├── schedule.py     # new: trajectory_weights, add_calendar_months
├── allocate.py     # imports only plan_types + schedule
├── five_percent.py # imports allocate at top; re-exports the old public names
└── tts.py          # imports allocate at top; re-exports MonthScore / StoreProjection
```

### Naming decision

The types module is called **`plan_types.py`**, not `types.py`. A top-level-looking
`planner/types.py` would shadow the stdlib `types` module whenever `src/planner/`
ends up first on `sys.path` (for example when a file in that folder is run as a
script), which breaks `dataclasses` / `enum`. `src/planner/cumulative_slope/types.py`
already exists in a sub-package and is **not touched**. That package also has its
own, different `MonthScore` class; it stays as is (possible later cleanup).

## Out of scope

- Merging `PlanResult`, `FivePercentPlanResult`, `TtsPlanResult` (changes the API).
- `planner.cumulative_slope` and its `MonthScore`.
- `backend/routers/plans.py` (only reads `chain_trajectory` / `projections` by
  attribute; unaffected by the move).
- Any change to numbers, bounds (`tts_bounds`) or request/response schemas.
- Frontend.

## Naming

| Kind   | Pattern                         | Example |
|--------|---------------------------------|---------|
| Spec   | `SPEC-T###-<slug>.md`           | `SPEC-T001-extract.md` |
| Report | `reports/REPORT-T###-<slug>.md` | created after the stage is done |

Same number links one spec to its report.

## Branch

`refactor/allocator-types` (from `main` at `aba6536`, after PR #41).

## Rules

1. One SPEC -> one commit -> one REPORT. The next stage starts only after the
   previous REPORT shows green checks, and after the user says "go".
2. Commit / push / PR only when the user asks.
3. Unrelated working-tree changes (`.env.docker.example`) are never part of this track.
4. REPORT records only commands that were actually run, with their result.
5. This README index is updated after every stage.
6. Commands run through `uv run` (no bare `python` / `pip`).

## Quality gates (same as CI)

```powershell
uv run ruff check src backend db tests
uv run mypy src/planner
uv run pytest tests/test_planner_five_percent.py tests/test_planner_tts.py tests/test_wave8_maintainability.py --no-cov -q
uv run pytest -q          # includes the 80 % coverage floor from pyproject.toml
```

## Index

| ID   | Stage | Spec | Report | Status |
|------|-------|------|--------|--------|
| T000 | Baseline (before any code change) | [SPEC](./SPEC-T000-baseline.md) | [REPORT](./reports/REPORT-T000-baseline.md) | DONE |
| T001 | Extract types and schedule helpers | [SPEC](./SPEC-T001-extract.md) | [REPORT](./reports/REPORT-T001-extract.md) | DONE |
| T002 | Remove lazy imports + dependency guard | [SPEC](./SPEC-T002-cleanup-guard.md) | [REPORT](./reports/REPORT-T002-cleanup-guard.md) | DONE |

## Dependency map (branch start)

| Name | Defined in | Used by |
|------|------------|---------|
| `MonthScore`, `StoreProjection` | `five_percent.py` | `allocate.py`, `tts.py` (+ re-export in `tts.__all__`) |
| `trajectory_weights`, `add_calendar_months` | `five_percent.py` | `allocate.py`, `tests/test_planner_five_percent.py` |
| `Direction` | `allocate.py` | `allocate.py` only |
| `allocate_plan` (lazy import) | `allocate.py` | `five_percent.py:85`, `tts.py:55` |
| `plan_five_percent`, `plan_tts` | `five_percent.py`, `tts.py` | `backend/routers/plans.py`, `tests/test_wave8_maintainability.py` |

Line numbers drift as stages land.

## Metrics (filled by reports)

| Moment | pytest passed | `allocate.py` imports from `five_percent` | lazy `allocate_plan` imports |
|--------|---------------|--------------------------------------------|------------------------------|
| Baseline (T000) | 228 | 4 names | 2 |
| After T001 | 233 | 0 | 2 |
| After T002 | 240 | 0 | 0 |
