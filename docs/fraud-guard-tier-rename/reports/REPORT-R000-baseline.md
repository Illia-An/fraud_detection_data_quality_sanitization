# REPORT-R000 - Baseline

| Field | Value |
|-------|-------|
| Spec | [SPEC-R000-baseline.md](../SPEC-R000-baseline.md) |
| Result | GREEN (no pre-existing failures) |
| Code change | none (track docs only) |

## Environment

- Branch: `refactor/tier-rename` (`git branch --show-current`).
- HEAD: `afcb136` (Merge pull request #42 — allocator-types).
- `git status --short`: ` M .env.docker.example` (unrelated), plus untracked
  `docs/fraud-guard-tier-rename/` (this track).

## Checks (all actually run)

| Check | Command | Result |
|-------|---------|--------|
| Ruff | `uv run ruff check src backend db tests` | `All checks passed!`, exit 0 |
| Mypy | `uv run mypy src/planner` | `Success: no issues found in 19 source files`, exit 0 |
| Focused | `uv run pytest tests/test_tier1.py tests/test_tier2.py tests/test_tier3.py tests/test_wave8_maintainability.py --no-cov -q` | **19 passed**, 1 warning, exit 0 |
| Full | `uv run pytest -q` | **240 passed**, 0 failed, 0 skipped; coverage **89.36 %**, exit 0 |

Warning: `StarletteDeprecationWarning` (httpx / starlette.testclient) — unrelated.

## Import inventory

`rg -n "from fraud_guard\.(tier1|tier2|tier3|pipeline_steps)|import fraud_guard\.(tier1|tier2|tier3)" src backend tests scripts`:

| Area | Files |
|------|-------|
| backend | `service.py` (tier1, tier2), `queries.py` (tier1) |
| src/fraud_guard | `__init__.py`, `pipeline_steps.py`, `stats.py`, `synthetic.py`, `tier2.py`→tier1, `tier3.py`→tier1 |
| tests | `test_tier1/2/3.py`, `test_wave8_maintainability.py`, `test_wave7_architecture.py` (string assert), query/snapshot tests |
| scripts | `export_always5_entities.py`, `generate_comparison_charts.py`, `run_tier2_explore.py` |

Wave 8 aliases already present: `src/fraud_guard/pipeline_steps.py` maps
`apply_blacklist_tier` → `apply_pipeline_tier1`, …, `apply_tier2` →
`apply_pipeline_tier4`. Physical files remain `tier1.py` / `tier2.py` /
`tier3.py`.

## Public surface (for shim completeness in R001)

**tier1.py:** `FLAG_COL`, `REASON_COL`, `ENTITY_COL`, reason constants,
`CUSTOMER_BLACKLIST_VALUE`, `SATISFACTION_QUESTION_ID`, `TOP_BOX_VALUE`,
`RATE_GET_ANSWERS_MAPPING`, `Tier1Config`, `filter_answered_metric_rows`,
`build_entity_key`, `apply_blacklist_tier`, `apply_freq_tier`,
`apply_always_topbox_tier`, `apply_tier1`, `keep_clean_rows`, `top_box_rate`
(+ private helpers).

**tier2.py:** `FLAG_COL`, `REASON_COL`, `REASON_HIGH_STORE_MONTH`, `Tier2Config`,
`build_store_month_panel`, `high_store_months`, `apply_tier2`, `keep_clean_rows`.

**tier3.py:** `FLAG_COL`, `REASON_COL`, `REASON_IF_ANOMALY`, `FEATURE_COLS`,
`Tier3Config`, `build_entity_feature_table`, `anomaly_entities`, `apply_tier3`,
`keep_clean_rows` (+ private helper). Lazy via `__init__.__getattr__`.

## Metrics for README

- pytest passed: **240**
- Physical modules use pipeline/research names: **no**
- Old `tier*.py` are shims: **no**
- First-party prefers new paths: **no**

## Naming lock (for R001)

As in README:

| Old | New |
|-----|-----|
| `tier1.py` | `pipeline_row_rules.py` |
| `tier2.py` | `pipeline_store_month.py` |
| `tier3.py` | `research_isolation_forest.py` |

Symbol names (`Tier1Config`, `apply_tier2`, FLAG string values) stay unchanged
in this track.

## Conclusion

Baseline green. Ready for R001 after user **go** (and confirmation of the
naming lock if needed).
