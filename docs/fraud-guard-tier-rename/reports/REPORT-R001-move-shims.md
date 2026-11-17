# REPORT-R001 - Move modules and add deprecated shims

| Field | Value |
|-------|-------|
| Spec | [SPEC-R001-move-shims.md](../SPEC-R001-move-shims.md) |
| Result | GREEN |
| Previous | [REPORT-R000](./REPORT-R000-baseline.md) |

## What changed

| Path | Change |
|------|--------|
| `src/fraud_guard/pipeline_row_rules.py` | moved from `tier1.py` (`git mv`); body unchanged |
| `src/fraud_guard/pipeline_store_month.py` | moved from `tier2.py`; import of mapping constants now from `pipeline_row_rules` |
| `src/fraud_guard/research_isolation_forest.py` | moved from `tier3.py`; same import fix |
| `src/fraud_guard/tier1.py` / `tier2.py` / `tier3.py` | thin re-export shims + `__all__` |
| `src/fraud_guard/__init__.py` | imports from new modules; lazy research path via `research_isolation_forest` |
| `src/fraud_guard/pipeline_steps.py` | imports from new modules |
| `tests/test_fraud_guard_module_layout.py` | new (5 identity / alias tests) |

Existing tests were not modified. No rule logic, thresholds, FLAG string values, or
API schemas changed. `backend/` / `scripts/` still import old paths (R002).

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Focused | tier1/2/3 + wave7 + wave8 + layout, `--no-cov -q` | **34 passed** |
| Full | `uv run pytest -q` | **245 passed** (240 + 5), coverage **89.41 %**, exit 0 |

## Metrics

- pytest passed: 240 → **245**
- Physical modules use pipeline/research names: **yes**
- Old `tier*.py` are shims: **yes**
- First-party prefers new paths: **no** (still on shims outside the package wiring)

## Next

R002 — switch `backend/` / `src/fraud_guard/` (non-shim) / `scripts/` imports to the
new modules — only after user **go**.
