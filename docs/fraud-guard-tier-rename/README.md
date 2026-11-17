# Fraud Guard Tier Rename (SDD)

Rename physical modules `fraud_guard.tier1` / `tier2` / `tier3` so their names
match the **pipeline** vocabulary, and keep the old module paths as deprecated
aliases. Origin: architecture review task 3 / M-09 / ARCH-05 / A-09.

## Problem

`PipelineConfig` and API `step_name` use a four-step vocabulary:

| Pipeline step | Meaning |
|---------------|---------|
| `tier1` | BlackList filter |
| `tier2` | Frequency (entity×store×day) |
| `tier3` | Always top-box |
| `tier4` | Store×month z / pct |

Physical files do **not** match that vocabulary:

| File | Actually contains |
|------|-------------------|
| `tier1.py` | Pipeline steps **1–3** (blacklist, freq, always-topbox) |
| `tier2.py` | Pipeline step **4** |
| `tier3.py` | Research IsolationForest (not used by the API pipeline) |

Wave 8 already added **function** aliases in `pipeline_steps.py`
(`apply_pipeline_tier1` … `apply_pipeline_tier4`). The files themselves are
still named `tier*`, so opening `tier2.py` still feels like “pipeline step 2”.

## Goal

- Physical modules named for their role in the pipeline / research split.
- Old import paths (`fraud_guard.tier1`, `.tier2`, `.tier3`) keep working as
  thin re-export shims (deprecated).
- **No behavior or number change.** No change to API `step_name`,
  `PipelineConfig` field names, or dataframe flag/reason column string values
  (`fraud_tier1_flag`, drop_reasons keys, etc.).
- First-party code prefers the new module paths.

## Target structure (naming locked for this track)

```
src/fraud_guard/
├── pipeline_row_rules.py          # was tier1.py  (pipeline steps 1–3)
├── pipeline_store_month.py        # was tier2.py  (pipeline step 4)
├── research_isolation_forest.py   # was tier3.py  (sklearn IF; API-lazy)
├── tier1.py                       # deprecated shim → pipeline_row_rules
├── tier2.py                       # deprecated shim → pipeline_store_month
├── tier3.py                       # deprecated shim → research_isolation_forest
├── pipeline_steps.py              # imports from the new modules
└── __init__.py                    # public exports; tier3 stays lazy
```

### Why these names

- Not `pipeline_tier1.py` for the first file: that file holds steps **1–3**, so
  a singular “tier1” filename would keep the same lie.
- Not renaming `Tier1Config` / `apply_tier2` symbols in this track: that is a
  larger API surface; module path clarity is the M-09 fix. Symbol tidy-up can
  be a later track.
- `research_isolation_forest.py` makes it obvious this is not pipeline `tier3`.

## Out of scope

- Renaming `PipelineConfig` keys or response `step_name` values.
- Renaming FLAG/REASON column **string values** or `meta.drop_reasons` keys.
- Splitting `pipeline_row_rules.py` into three files.
- M-10 (PII hash-once), sklearn packaging extras, frontend.
- Any change to rule thresholds, defaults, or sanitization numbers.
- Deleting the shim modules in this track (removal = later major bump).

## Naming

| Kind   | Pattern                         | Example |
|--------|---------------------------------|---------|
| Spec   | `SPEC-R###-<slug>.md`           | `SPEC-R001-move-shims.md` |
| Report | `reports/REPORT-R###-<slug>.md` | created after the stage |

## Branch

`refactor/tier-rename` (from `main` at `afcb136`, after PR #42 / tag
`v1.37.0-allocator-types`).

## Rules

1. One SPEC -> one commit -> one REPORT. Next stage only after a green REPORT
   and the user says "go".
2. Commit / push / PR only when the user asks.
3. Unrelated working-tree changes (`.env.docker.example`) are never part of
   this track.
4. REPORT records only commands that were actually run.
5. This README index is updated after every stage.
6. Commands through `uv run` (no bare `python` / `pip`).

## Quality gates (same as CI)

```powershell
uv run ruff check src backend db tests
uv run mypy src/planner
uv run pytest tests/test_tier1.py tests/test_tier2.py tests/test_tier3.py tests/test_wave8_maintainability.py --no-cov -q
uv run pytest -q
```

## Index

| ID   | Stage | Spec | Report | Status |
|------|-------|------|--------|--------|
| R000 | Baseline (before any code change) | [SPEC](./SPEC-R000-baseline.md) | [REPORT](./reports/REPORT-R000-baseline.md) | DONE |
| R001 | Move modules + deprecated shims | [SPEC](./SPEC-R001-move-shims.md) | [REPORT](./reports/REPORT-R001-move-shims.md) | DONE |
| R002 | Switch first-party imports to new paths | [SPEC](./SPEC-R002-switch-imports.md) | [REPORT](./reports/REPORT-R002-switch-imports.md) | DONE |
| R003 | Deprecation warning + import guard | [SPEC](./SPEC-R003-deprecate-guard.md) | [REPORT](./reports/REPORT-R003-deprecate-guard.md) | DONE |

## Import map (branch start)

| Consumer group | Imports `tier1` / `tier2` / `tier3` |
|----------------|-------------------------------------|
| `backend/service.py` | `tier1`, `tier2` |
| `backend/queries.py` | `tier1` |
| `src/fraud_guard/{__init__,pipeline_steps,stats,synthetic,tier2,tier3}` | see code |
| `tests/test_tier*.py` + several query/snapshot tests | `tier1` / `tier2` / `tier3` |
| `scripts/*` | explore / charts / export |

`pipeline_steps.py` already re-exports pipeline-named **callables**; it still
loads them from the old modules.

## Metrics (filled by reports)

| Moment | pytest passed | Physical modules use pipeline/research names | Old `tier*.py` are shims | First-party prefers new paths |
|--------|---------------|----------------------------------------------|--------------------------|-------------------------------|
| Baseline (R000) | 240 | no | no | no |
| After R001 | 245 | yes | yes | no |
| After R002 | 246 | yes | yes | yes |
| After R003 | 302 | yes | yes + warn | yes |
