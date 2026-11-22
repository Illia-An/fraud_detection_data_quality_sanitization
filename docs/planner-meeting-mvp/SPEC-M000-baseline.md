# SPEC-M000 — Baseline

| Field | Value |
|-------|-------|
| Status | TODO |
| Depends on | — |
| Code change | none |
| Report | `reports/REPORT-M000-baseline.md` (after run) |

## Goal

Record a verified green-before state on the meeting-MVP branch so later stages
can be compared against it.

## In scope

- Confirm branch from tagged `main` (Inspect UX / post-#47).
- Run and record web quality gates.
- Note key Planner entry points and existing plan-store / simulation APIs.

## Out of scope

- Any product or code change.

## Steps

1. Confirm `main` (or track branch) includes merge #47 / tag `v1.42.0-planner-inspect-ux` (or newer).
2. In `web/`: `npm run lint`, `npm run test:run`, `npm run build`.
3. Optionally: `uv run pytest` for planner-related backend tests.
4. Record line counts: `PlannerPage.tsx`, `StoreInspectPage.tsx`, At-risk section files.
5. Write REPORT-M000.

## Acceptance

| Check | Command | Expected |
|-------|---------|----------|
| Lint | `cd web && npm run lint` | exit 0 |
| Unit | `cd web && npm run test:run` | all pass |
| Build | `cd web && npm run build` | exit 0 |

Pre-existing reds are recorded as pre-existing; not fixed in M000.

## Risks / rollback

None — documentation only.
