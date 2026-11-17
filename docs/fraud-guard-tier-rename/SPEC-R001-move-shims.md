# SPEC-R001 - Move modules and add deprecated shims

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | R000 report green + user "go" |
| Risk | Medium (many import sites; mitigated by shims) |
| Report | `reports/REPORT-R001-move-shims.md` |

## Goal

Physical code lives under pipeline/research module names; `tier1` / `tier2` /
`tier3` remain importable as thin re-export shims. **No symbol renames, no
logic edits.**

## In scope

1. Move (verbatim) module bodies:
   - `tier1.py` → `pipeline_row_rules.py`
   - `tier2.py` → `pipeline_store_month.py`
   - `tier3.py` → `research_isolation_forest.py`
2. Fix intra-package imports inside the moved modules (e.g. store-month and
   research modules currently import from `fraud_guard.tier1` → point at
   `fraud_guard.pipeline_row_rules`).
3. Replace `tier1.py` / `tier2.py` / `tier3.py` with shims that re-export the
   same public names (and preserve lazy `tier3` / sklearn behaviour for
   `__init__.py`).
4. Point `pipeline_steps.py` and `__init__.py` at the new modules.
5. New test `tests/test_fraud_guard_module_layout.py`: identity checks
   (`fraud_guard.tier1.Tier1Config is fraud_guard.pipeline_row_rules.Tier1Config`,
   same pattern for tier2/store_month and tier3/research; `pipeline_steps`
   callables still resolve).
6. Existing tests stay unchanged and must keep passing via the shims.

## Out of scope

- Migrating `backend/` / `scripts/` imports (R002).
- `DeprecationWarning` (R003).
- Renaming classes or FLAG column string values.

## Acceptance

| Check | Expected |
|-------|----------|
| Ruff / mypy / focused + layout / full pytest | green |
| `import fraud_guard.tier1` etc. | still works |
| Diff of moved bodies | logic unchanged (path/import lines only) |

## Risks / rollback

- Missed re-export → ImportError. Mitigate: layout identity tests + full suite.
- Rollback: `git revert` of the stage commit.
