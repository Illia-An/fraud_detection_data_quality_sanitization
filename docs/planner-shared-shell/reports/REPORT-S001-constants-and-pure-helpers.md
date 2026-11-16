# REPORT-S001 - Constants and pure helpers

| Field | Value |
|-------|-------|
| Spec | [SPEC-S001](../SPEC-S001-constants-and-pure-helpers.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` |
| Result | **GREEN** |
| Commit | not committed (waiting for user request) |

## What was done

1. `plannerShell.ts`
   - Added shared constants: `PLANNER_AT_RISK_SUMMARY_RESERVE_PX` (80),
     `PLANNER_AT_RISK_GAP_PX` (12), `PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT` ('45vh'),
     `PLANNER_PREFERRED_REFERENCE` ({ 2025, 12 }). Values are unchanged.
   - Added `PlannerReference` type and pure `pickReference(refs, year, month)`.
2. `PlannerPage.tsx`
   - Removed local `COLLAPSED_PLAY_REVEAL_MS`, `AT_RISK_*`, `PREFERRED_REFERENCE`.
   - Now uses the shared constants, including `PLANNER_COLLAPSED_PLAY_REVEAL_MS`
     (it already existed in the shell but the page kept its own copy).
   - Reference effect now calls `pickReference`.
3. `TtsPlannerPage.tsx`
   - Removed local `AT_RISK_*` and `PREFERRED_REFERENCE`; imports shared ones.
   - Reference effect now calls `pickReference`.
4. New `plannerShell.test.ts` (5 tests).

The effects stay in the pages with the same dependency arrays; only the
decision moved into `pickReference`. A guard skips `setState` when the picked
value equals the current one.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| Lint (source) | `npx eslint src --max-warnings 0` | exit 0 |
| Focused tests | `npx vitest run plannerShell.test.ts PlannerPage.test.tsx TtsPlannerPage.test.tsx` | 3 files, 16 tests passed |
| Full unit tests | `npm run test:run` | **79 files, 341 tests passed** (baseline 78 / 336; +1 file, +5 tests) |
| Build | `npm run build` | exit 0 (`tsc -b && vite build`) |
| Leftover old names | search for `AT_RISK_*`, `PREFERRED_REFERENCE`, `COLLAPSED_PLAY_REVEAL_MS` in both pages | none |
| e2e / Docker manual | not run in S001 | planned for S004 / S005 |

### Prettier note (pre-existing)

`prettier --check` reports the touched files, but it also reports the same
files at `HEAD` before any change, and `prettier` output for `plannerShell.ts`
has no content difference from the file, so this looks like line-ending
(CRLF/LF) noise on this machine. CI does not run prettier (no `format:check`
or `prettier` in `.github`). No reformatting was done, to keep the diff minimal.

## Metrics (measured)

| File | Baseline | After S001 | Delta |
|------|----------|------------|-------|
| `PlannerPage.tsx` | 1598 | 1590 | -8 |
| `TtsPlannerPage.tsx` | 1225 | 1214 | -11 |
| `plannerShell.ts` | 8 | 47 | +39 |
| `plannerShell.test.ts` | - | 46 | +46 |

`git diff --stat -- web`: 3 files, +77 / -55 (the new test file is untracked and
not in that count).

Honest read: the line reduction in the pages is small. This stage is about
removing duplicated sources of truth, not about shrinking the pages; the real
size reduction is expected from S002-S004.

## Deviations from SPEC

- None in behavior. Constants kept identical values.
- The effect body was not moved into a hook (that is S002).

## Residual risks

- Low. Behavior is covered by existing page tests plus the new
  `pickReference` unit tests (empty, keep-valid, fallback-to-preferred,
  fallback-to-latest, constant values).
- Visual/manual check on Docker not done yet; At-risk geometry values are
  unchanged, so no visual difference is expected.

## Working tree

- `M .env.docker.example` - unrelated, still excluded from this track.
- Changed: `plannerShell.ts`, `PlannerPage.tsx`, `TtsPlannerPage.tsx`.
- New: `plannerShell.test.ts`, this report.

## Next

[SPEC-S002 - Shell hooks](../SPEC-S002-shell-hooks.md): onboarding effect,
collapsed-Play reveal, reference-selection hook. Waiting for user go-ahead.
