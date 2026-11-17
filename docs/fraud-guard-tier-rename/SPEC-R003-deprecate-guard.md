# SPEC-R003 - Deprecation warning and import guard

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | R002 report green + user "go" |
| Risk | Low |
| Report | `reports/REPORT-R003-deprecate-guard.md` |

## Goal

Make the old module paths loudly deprecated and prevent new first-party code
from depending on them.

## In scope

1. Emit `DeprecationWarning` when `fraud_guard.tier1` / `tier2` / `tier3` are
   imported (module-level, once). Message points at the replacement module.
2. Filter or expect the warning in any remaining intentional shim tests.
3. Extend `tests/test_fraud_guard_module_layout.py` with an AST (or path) guard:
   `backend/` and non-shim `src/fraud_guard/*.py` must not import
   `fraud_guard.tier1` / `tier2` / `tier3`.
4. Sanity: temporarily add a forbidden import, confirm the guard fails, revert.

## Out of scope

- Deleting the shim files.
- Changing warning into an error.

## Acceptance

| Check | Expected |
|-------|----------|
| Importing a shim | raises `DeprecationWarning` |
| Guard | fails on forbidden import, passes after revert |
| Full pytest | green |

## Risks / rollback

- Noisy warnings in scripts still on old paths — R002 should have switched them.
- Rollback: `git revert`.
