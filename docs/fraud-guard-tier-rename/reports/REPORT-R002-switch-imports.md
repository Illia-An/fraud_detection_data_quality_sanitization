# REPORT-R002 - Switch first-party imports to new paths

| Field | Value |
|-------|-------|
| Spec | [SPEC-R002-switch-imports.md](../SPEC-R002-switch-imports.md) |
| Result | GREEN |
| Previous | [REPORT-R001](./REPORT-R001-move-shims.md) |

## What changed

Import path only (no logic):

| Area | Files |
|------|-------|
| backend | `service.py` → `pipeline_row_rules` + `pipeline_store_month`; `queries.py` → `pipeline_row_rules` |
| src/fraud_guard | `stats.py`, `synthetic.py` → `pipeline_row_rules` |
| scripts | `export_always5_entities.py`, `run_tier2_explore.py`, `generate_comparison_charts.py` |
| tests | `test_tier1/2/3`, `test_wave8_maintainability`, `test_queries`, `test_query_b`, `test_query_b_phase2`, `test_snapshot` |
| layout | added `test_old_tier_import_paths_still_work` (shim smoke) |

Shim modules `tier1.py` / `tier2.py` / `tier3.py` unchanged. Note:
`export_always5_entities.py` imports private `_flag_always_topbox`; that only
works from `pipeline_row_rules` (shim never re-exported it).

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| First-party graph | `rg -n "from fraud_guard\.tier[123]\|import fraud_guard\.tier[123]" backend src/fraud_guard scripts` | **no matches** (rg exit 1) |
| Remaining tests | layout shim smoke + wave7 string assert on `__init__.py` text | expected |
| Ruff | `uv run ruff check src backend db tests` | exit 0 |
| Mypy | `uv run mypy src/planner` | exit 0 |
| Focused | layout + tier1/2/3 + wave7 + wave8, `--no-cov -q` | **35 passed** |
| Full | `uv run pytest -q` | **246 passed** (245 + 1), coverage **89.41 %**, exit 0 |

## Metrics

- pytest passed: 240 → 245 → **246**
- Physical modules use pipeline/research names: yes
- Old `tier*.py` are shims: yes
- First-party prefers new paths: **yes**

## Next

R003 — `DeprecationWarning` on shim import + AST guard — only after user **go**.
