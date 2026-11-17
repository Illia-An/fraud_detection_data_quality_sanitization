# SPEC-R002 - Switch first-party imports to new paths

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | R001 report green + user "go" |
| Risk | Low |
| Report | `reports/REPORT-R002-switch-imports.md` |

## Goal

First-party production code imports the new modules directly. Shims remain for
external/old paths and for existing tests that still use `tier*`.

## In scope

1. Update imports in `backend/` and `src/fraud_guard/` (except the shim files
   themselves) to `pipeline_row_rules` / `pipeline_store_month` /
   `research_isolation_forest` as appropriate.
2. Update `scripts/` the same way (first-party tooling).
3. Leave `tests/` on old paths **or** migrate them — prefer migrate tests that
   are clearly “unit tests of the module under its new name”, keep at least one
   shim-import assertion in the layout test.
4. No logic changes.

## Out of scope

- Removing shims.
- DeprecationWarning (R003).
- Frontend / API schema renames.

## Acceptance

| Check | Expected |
|-------|----------|
| `rg "from fraud_guard\.tier[123]" backend src/fraud_guard scripts` | only shim modules (and maybe comments/docs) |
| Ruff / mypy / full pytest | green |

## Risks / rollback

- Rollback: `git revert`.
