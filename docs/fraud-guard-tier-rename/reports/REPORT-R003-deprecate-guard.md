# REPORT-R003 - Deprecation warning and import guard

| Field | Value |
|-------|-------|
| Spec | [SPEC-R003-deprecate-guard.md](../SPEC-R003-deprecate-guard.md) |
| Result | GREEN |
| Previous | [REPORT-R002](./REPORT-R002-switch-imports.md) |

## What changed

| File | Change |
|------|--------|
| `src/fraud_guard/tier1.py` | module-level `DeprecationWarning` → use `pipeline_row_rules` |
| `src/fraud_guard/tier2.py` | same → `pipeline_store_month` |
| `src/fraud_guard/tier3.py` | same → `research_isolation_forest` |
| `tests/test_fraud_guard_module_layout.py` | deprecation re-import tests; AST guard over `backend/**/*.py` and non-shim `src/fraud_guard/*.py`; shim identity tests filter the warning |

Shims still re-export; they are not deleted.

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Layout | `uv run pytest tests/test_fraud_guard_module_layout.py --no-cov -q` | **62 passed** |
| Full | `uv run pytest -q` | **302 passed**, coverage **89.42 %**, exit 0 |

## Sanity of the guard (temporary edit, reverted)

| Case | Edit | Result |
|------|------|--------|
| Forbidden | `stats.py`: `from fraud_guard.tier1 import FLAG_COL` | guard failed: `stats.py imports deprecated ['fraud_guard.tier1']` (1 failed / 52 passed on the parametrized guard) |
| After revert | restore `pipeline_row_rules` | layout **62 passed** again |

## Metrics

- pytest passed: 240 → 245 → 246 → **302**
- Physical modules use pipeline/research names: yes
- Old `tier*.py` are shims: **yes + DeprecationWarning**
- First-party prefers new paths: yes (+ AST guard)

## Track status

R000–R003 done. Nothing committed; `.env.docker.example` remains unrelated dirty.
