# SPEC-D005 - Verification / handoff

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | D001–D004 (or earlier stop) |
| Code change | docs / metrics only (unless tiny fix) |
| Report | `reports/REPORT-D005-verification-handoff.md` |

## Goal

Final before/after metrics, confirm pages still import one entry point, list
follow-ups outside this track, and hand off.

## In scope

1. Re-run full quality gates; record results.
2. Line-count table: baseline vs final for drawer (+ new `storeAudit/` files).
3. Confirm `PlannerPage` / `TtsPlannerPage` still use `StoreAuditDrawer` (or
   documented thin re-export).
4. Follow-ups: TTS Playwright locator flake, `coverage/` eslintignore, scenario
   store merge — **out of this track**.
5. Update README index to DONE; write REPORT.

## Out of scope

- New feature work or redesign.
- Weakening Playwright asserts to greenwash flake.

## Acceptance

| Check | Expected |
|-------|----------|
| Index D000–D00x | DONE (or SKIPPED where intentional) |
| Before/after lines | in README |
| No user-visible behavior change | confirmed by tests + review |
| Handoff note | in REPORT |

## Risks / rollback

N/A for docs-only closeout.
