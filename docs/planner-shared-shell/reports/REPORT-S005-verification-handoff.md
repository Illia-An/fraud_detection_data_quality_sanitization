# REPORT-S005 - Final verification and handoff

| Field | Value |
|-------|-------|
| Spec | [SPEC-S005](../SPEC-S005-verification-handoff.md) |
| Date | 2026-11-16 |
| Branch | `feat/shared-planner-shell` (HEAD `b4ef30b`, **nothing committed**: S001..S004 are working-tree changes) |
| Result | **GREEN with caveats**: all automated gates pass; product tour was **not** walked through manually in Docker (see "Not verified") |
| Code change in S005 | none (docs only) |

## Checks (actually run)

From `web/`:

| Check | Command | Result |
|-------|---------|--------|
| Types | `npx tsc -b` | exit 0 (S004 run) |
| Lint, source | `npx eslint src --max-warnings 0` | exit 0 (S004 run) |
| Lint, full | `npm run lint` | **exit 1**: 3 warnings, all in generated `web/coverage/lcov-report/*.js` ("unused eslint-disable"). `web/coverage` is gitignored, not present in CI. Not caused by this track |
| Unit tests + coverage | `npm run test:coverage` | **84 files, 378 tests passed**; exit 0 (thresholds unchanged and met). Statements 84.47 %, Branches 81.14 %, Functions 78.05 %, Lines 84.47 % |
| Build | `npm run build` | exit 0 |
| e2e `planner.spec.ts` | `npx playwright test` | 1 passed |
| e2e `tts-kitchen.spec.ts` | same | 1 passed |
| e2e `tts-planner.spec.ts` | same | **failed 1 of 1** in the combined run, see below |

### `tts-planner` e2e failure is pre-existing

Same spec on a clean `git worktree` of `HEAD` (`b4ef30b`, no track changes), `--repeat-each=6`:
**1 failed, 5 passed**, same error (strict-mode violation on
`tts-allocation-levers` `.or` `tts-planner-ap-failed` `.or` `tts-planner-loading-ap`: levers card and
loading alert are visible together). On the working tree: failed on 3 of 5 runs across S004/S005, passed on
the rest. Both trees fail mostly on the first (cold-start) run. Conclusion: a race in the spec's locator,
not a regression from the track. The sample is small; I did not fix the spec (out of scope).

Docker smoke (deploy-style image built from the working tree, `docker build -t fraud-dq-sanitization:s005-smoke .`, exit 0).
Run as a separate container on port **8010** with the snapshots mounted read-only and
`SNAPSHOT_MAX_AGE_DAYS=36500`. The running `fraud-dq` container on port 8000 was not touched.

| Check | Result |
|-------|--------|
| `GET /health` | 200 |
| `GET /ready` | `status: ready`, `schema_ok: true`, `snapshot_row_count: 980160`, `reasons: []` |
| `/planner-tts` loads, shows AP baseline (Current 5.19 min, 234 stores) | yes |
| TTS rail collapse / expand | works; **no** collapsed Play on TTS (same as before) |
| TTS "Run simulation" | plan appears: answer chip "Manual run", Undo, Hero chart, At-risk dock at bottom "Behind 41 · Ahead 168" |
| TTS At-risk dock expand | table opens as an overlay over the hero pane |
| TTS Undo (from empty state) | returns to the empty "chart appears after Run simulation" state |
| `/planner` (no sanitization yet) rail collapse | `data-collapsed=true`, rail width 40 px, `collapsed-run` shown after 500 ms |
| `/planner` rail expand | `data-collapsed=false`, width 320 px, `collapsed-run` gone |

Smoke container was removed afterwards (`docker rm -f fraud-dq-s005-smoke`). The image tag
`fraud-dq-sanitization:s005-smoke` still exists locally.

## Not verified (open)

- **Onboarding tour on both planners in Docker.** I started the tour (it has 13 steps and
  navigates to `/` first) but did not step through the planner / TTS-planner steps. The tour logic is
  covered only by `usePlannerOnboardingShell.test.ts` (14 tests) and `tourConfig.test.ts`.
  Needs a human pass: Planner after a sanitization run, TTS planner after a run.
- **`PlannerPage` pack -> Undo and Store-mix** flows (needs sanitization data + a plan run): covered by
  unit / page tests only. TTS "Run -> Undo" was tried by hand; TTS **pack** -> Undo was not.
- `PlannerPage` At-risk dock (`planner-at-risk-sheet`) not seen in the browser, only in
  `planner.spec.ts` (which passed).

## Metrics (non-empty lines; measured)

| File | Baseline S000 | S001 | S002 | S003 | S004 = final |
|------|---------------|------|------|------|--------------|
| `PlannerPage.tsx` | 1598 | 1590 | 1532 | 1523 | **1362** (-236) |
| `TtsPlannerPage.tsx` | 1225 | 1214 | 1171 | 1159 | **1023** (-202) |
| Pages total | 2823 | 2804 | 2703 | 2682 | **2385** (-438, -15.5 %) |

| Suite | Baseline S000 | Final |
|-------|---------------|-------|
| Test files | 78 | **84** |
| Tests | 336 | **378** (+42) |

New shared production code (non-empty lines): `plannerShell.ts` +43, hooks 59 + 21 + 31 + 83 = 194,
`PlannerPageShell.tsx` 147, `PlannerAtRiskDock.tsx` 111, so about **495 lines**. Net production code
is therefore about **+57 lines** versus baseline (pages -438, shared +495). The gain of the track is that the
duplicated shell now exists once, with 42 new tests, not a smaller codebase. Test code added: five hook /
shell test files plus `plannerShell.test.ts`.

## Before / after (per stage)

| Stage | What moved out of the pages |
|-------|-----------------------------|
| S001 | at-risk geometry constants, preferred reference, `pickReference` |
| S002 | onboarding rail/at-risk/scroll effect, collapsed Play reveal timer, reference selection state + effect |
| S003 | pack / mix / active answer / note / undo state, undo capture/consume, answer reset |
| S004 | outer frame, rail + toggle, collapsed Play column, main column, At-risk dock geometry |

## Deviations from SPEC (whole track, short)

See each stage report. The ones worth remembering: `resetAnswerState` leaves `pendingPackId` /
`pendingMixId` alone; collapsed Play and At-risk are a slot / separate component instead of
`onCollapsedPlay` / `atRisk`; `data-collapsed` is now also emitted on the TTS rail.

## Follow-ups (not done, outside the track)

1. `SanitizationPage` and `TtsKitchenPage` still carry their own copy of the collapsed Play reveal timer
   (`useCollapsedPlayReveal` fits them).
2. Split `StoreAuditDrawer` (the largest remaining planner component).
3. `allocate` types (shared planner/TTS request types) and the tier rename, per the architecture review.
4. Merge `plannerScenarioStore` and `ttsPlannerScenarioStore` (explicitly excluded here).
5. The `tts-planner.spec.ts` first-step locator: use a single element or `.first()` so it cannot hit
   the strict-mode violation.
6. `npm run lint` fails locally only because of generated `web/coverage/lcov-report/*.js`; consider
   ignoring `coverage/` in the ESLint config.
7. React `act(...)` warnings for `FormControl` and jsdom `Not implemented: navigation` noise in the page tests.

## Housekeeping left for the user

- **A temporary git worktree is still registered:** `C:\McDonalds\01_SOURCES(clean_code)\_wt_head_s005`
  (detached `HEAD`). It contains a **junction** `web\node_modules` -> this repo's `web\node_modules`.
  My attempts to remove it were blocked, so it is still there. Safe removal: delete the junction
  *only* (`cmd /c rmdir "<worktree>\web\node_modules"` removes the link, not the target), then
  `git worktree remove --force "<worktree>"`. Do not recursively delete the junction.
- Local image `fraud-dq-sanitization:s005-smoke` can be removed with `docker rmi`.
- `M .env.docker.example` is unrelated and still excluded.

## Working tree (all uncommitted)

- Modified: `plannerShell.ts`, `PlannerPage.tsx`, `TtsPlannerPage.tsx`, `.env.docker.example` (unrelated).
- New: `useAnswerShell`, `useCollapsedPlayReveal`, `usePlannerOnboardingShell`, `useReferenceSelection`,
  `PlannerPageShell`, `PlannerAtRiskDock` (+ their tests, `plannerShell.test.ts`), and `docs/planner-shared-shell/`.

Per the track rules, S001..S004 each wanted its own commit; nothing has been committed yet. Committing,
merging to `main`, tagging and deploying happen only on explicit request.
