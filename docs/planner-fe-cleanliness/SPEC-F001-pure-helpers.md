# SPEC-F001 - Pure helpers (baseline + CSV)

| Field | Value |
|-------|-------|
| Status | DONE |
| Depends on | F000 report green + user "go" |
| Risk | Low |
| Report | `reports/REPORT-F001-pure-helpers.md` |

## Goal

Extract shared pure functions used by both planner pages into
`web/src/components/planner/` with unit tests. Pages import helpers; local
duplicates are removed. Behavior identical.

## In scope

1. `plannerBaseline.ts` (name may vary slightly):
   - available references from a row list (`year`/`month` + `periodLabel`)
   - baseline rows at reference (metric field as parameter / mapper)
   - equal-weight chain mean (value accessor / key)
2. `plannerCsv.ts`: shared CSV blob download; metric-specific header/filename/
   row builders as parameters (do **not** force one CSV format).
3. Unit tests next to the modules (`*.test.ts`).
4. Wire both pages to the helpers; delete local copies.

## Out of scope

- Goal draft hook (F002).
- Export/save chrome state (F003).
- `handleRun` / simulation / StoreAuditDrawer.

## Acceptance

| Check | Expected |
|-------|----------|
| `npx tsc -b` / `npm run lint` / `npm run test:run` | green |
| Pages | import helpers; no local duplicate of extracted functions |
| Line counts | recorded; should drop vs F000 |
| Playwright planner + tts-planner | green or pre-existing flake noted |

## Risks / rollback

- Subtle metric-field mismatch (`five_percent` vs `tts`). Mitigate: typed mappers + tests.
- Rollback: `git revert` of the stage commit.
