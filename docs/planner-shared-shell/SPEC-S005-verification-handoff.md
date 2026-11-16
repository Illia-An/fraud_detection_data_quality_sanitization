# SPEC-S005 - Final verification and handoff

| Field | Value |
|-------|-------|
| Status | DONE (green with caveats) - see [REPORT-S005](./reports/REPORT-S005-verification-handoff.md) |
| Depends on | S001-S004 reports green |
| Code change | none (docs / metrics only) |

## Goal

Prove the whole track is behavior-neutral and record the outcome.

## Steps

1. Full web gates: `npm run lint`, `npm run test:run`, `npm run test:coverage`
   (coverage thresholds unchanged), `npm run build`.
2. Playwright TTS e2e subset (local browser).
3. Docker smoke on the deploy-style container: `/ready`, both planner routes,
   onboarding tour on both, rail collapse/expand.
4. Re-measure line counts of both pages and the new shell files.
5. Update this README (index statuses + metrics table).
6. Write REPORT-S005 with before/after table and open follow-ups.

## Acceptance

| Check | Expected |
|-------|----------|
| All gates | green, same or higher test count than S000 |
| Metrics | before/after line counts recorded (measured) |
| Follow-ups | listed (SanitizationPage / TtsKitchenPage reuse, StoreAuditDrawer split, `allocate` types, tier rename) |

## Out of scope

Merging to `main`, tagging, deploy. Those happen only on explicit user request.
