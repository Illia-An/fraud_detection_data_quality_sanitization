# REPORT-S004 - Layout shell

| Field | Value |
|-------|-------|
| Spec | [SPEC-S004](../SPEC-S004-layout-shell.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` |
| Result | **GREEN** for tsc / eslint / unit / build / `planner` e2e. `tts-planner` e2e is **flaky** (see Checks). Manual Docker check pending |
| Commit | not committed (S001..S004 are all uncommitted) |

## What was done

Two layout-only components in `web/src/components/planner/`:

| Component | Owns | Props |
|-----------|------|-------|
| `PlannerPageShell` | outer flex frame, `aside` rail (width / padding / transition from `controlsOpen`, collapse toggle with the same i18n keys and aria), always-mounted rail content wrapper, collapsed-Play column, `main` column | `controlsOpen`, `onToggleControls`, `railTestId`, `showCollapsedPlay?`, `collapsedPlay?`, `rail`, `children` |
| `PlannerAtRiskDock` | bottom overlay (md) / in-flow (xs) geometry, shadow, accordion + summary (title, behind/ahead counts) and details max-height | `expanded`, `onExpandedChange`, `behindCount`, `aheadCount`, `testId`, `onboardingId`, `stableScrollbar?`, `children` |

Pages:
- `TtsPlannerPage` (done first, as SPEC says): `railTestId="tts-controls-rail"`; At-risk dock with
  `tts-planner-at-risk` as both test id and onboarding id.
- `PlannerPage`: `railTestId="controls-rail"`, `showCollapsedPlay` + the existing run
  `IconButton` (with `data-testid="collapsed-run"`) passed as `collapsedPlay`;
  dock with `planner-at-risk-sheet` / `planner-at-risk` and `stableScrollbar`.
- Rail content, main content, hero, `AtRiskDeltaTable`, `StoreAuditDrawer` stay in the
  pages. Inner JSX indentation was intentionally not changed (minimal diff).
- Removed from both pages: `useTheme`, `railWidth`, chevron icons,
  `PLANNER_AT_RISK_OVERLAY_MAX_HEIGHT` / `PLANNER_RAIL_*` imports. Hero bottom padding
  still uses `PLANNER_AT_RISK_SUMMARY_RESERVE_PX` / `GAP_PX` in the pages.

All `data-testid` and `data-onboarding` anchors are unchanged.

## Checks (actually run, from `web/`)

| Check | Command | Result |
|-------|---------|--------|
| Types | `npx tsc -b` | exit 0 |
| Lint (source) | `npx eslint src --max-warnings 0` | exit 0 |
| Focused tests | shell test + `src/pages` | 5 files, 25 tests passed |
| Full unit tests | `npm run test:run` | **84 files, 378 tests passed** (S003: 83 / 372; +1 file, +6 tests) |
| Build | `npm run build` | exit 0 |
| e2e `planner.spec.ts` | `npx playwright test tests/e2e/planner.spec.ts` | 1 passed |
| e2e `tts-planner.spec.ts` | same, `--repeat-each=3` | **1 of 3 failed, 2 passed** (also 1 failed on the first run) |

The `tts-planner` failure is a strict-mode violation in the test locator
(`tts-allocation-levers` `.or` `tts-planner-loading-ap` `.or` `tts-planner-ap-failed`): when the
first poll happens while the AP baseline is still loading, both the levers card (always in the
rail) and the loading alert are visible, so Playwright throws. It depends on how fast the backend
answers. It is a race in the test, and the rail content and loading alert are unchanged by this
stage, but I **did not run the same spec against `HEAD`**, so "pre-existing" is not proven by a run.

New tests, `PlannerPageShell.test.tsx` (6): slots + rail test id; `data-collapsed` and
toggle `aria-expanded` follow `controlsOpen` and rail content stays mounted when collapsed;
toggle calls `onToggleControls`; collapsed Play only when closed and revealed; dock renders
anchors and slot; dock reports expand changes.

## Metrics (non-empty lines, same method as baseline)

| File | Baseline (S000) | After S001 | After S002 | After S003 | After S004 |
|------|-----------------|------------|------------|------------|------------|
| `PlannerPage.tsx` | 1598 | 1590 | 1532 | 1523 | **1362** |
| `TtsPlannerPage.tsx` | 1225 | 1214 | 1171 | 1159 | **1023** |

New: `PlannerPageShell.tsx` (147), `PlannerAtRiskDock.tsx` (111), `PlannerPageShell.test.tsx` (109).

## Deviations from SPEC

- **Collapsed Play is a slot (`collapsedPlay`), not `onCollapsedPlay`.** The button depends on
  `canRun`, tooltip text and the pending spinner; a slot keeps that in the page and the shell
  owns only the column.
- **Second component `PlannerAtRiskDock`** instead of an `atRisk` slot on the shell: the At-risk
  accordion sits inside the hero pane, not as a sibling of rail / main, so it cannot be a shell slot.
- **`drawer` slot not added.** `StoreAuditDrawer` sits at different depths in the two pages;
  it stays in the page as part of `children`.
- **`stableScrollbar` flag.** `PlannerPage` sets `scrollbarGutter: 'stable'` on the dock and its
  details; `TtsPlannerPage` never did. The flag keeps both exactly as before.
- **`data-collapsed` is now also rendered on the TTS rail** (it was only on `PlannerPage`). It is
  an inert DOM attribute with no style or test depending on it; noted as the only DOM difference.

## Residual risks

- Manual Docker check (rail collapse/expand animation, collapsed Play, At-risk expand, tour
  highlights on both planners) is **not done**. Unit tests do not cover real layout.
- `tts-planner` e2e flakiness above; worth re-running against `HEAD` to confirm.
- jsdom prints React `act(...)` warnings for `FormControl` in the page tests; tests pass.

## Working tree

- `M .env.docker.example` - unrelated, still excluded.
- Changed in S004: `PlannerPage.tsx`, `TtsPlannerPage.tsx`.
- New in S004: `PlannerPageShell.tsx`, `PlannerAtRiskDock.tsx`, `PlannerPageShell.test.tsx`.

## Next

[SPEC-S005 - Final verification + handoff](../SPEC-S005-verification-handoff.md). Waiting for user go-ahead.
