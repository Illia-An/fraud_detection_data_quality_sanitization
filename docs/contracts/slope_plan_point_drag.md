# SPEC: Slope Plan — draggable plan points (live recompute)

**Branch:** `exp/slope-plan-point-drag`  
**Parent contract:** [`slope_plan_cum_to_target.md`](slope_plan_cum_to_target.md)  
**Metric:** Q10012 five_percent (network Hero + store Inspect Slope)  
**Status:** Phase 1 (draft drag) — implemented on branch; Save persist = Phase 2

---

## Goal

Real drag of **Plan** points on both Slope charts (cumulative + monthly), with
**live local recompute** of a consistent plan package (network + store
allocation). Not a cosmetic-only edit. Simulation is not draggable.

Phase 1 is **draft-only**. Persisting edited path on Save is **Phase 2**.

---

## Product locks

### L0 — Two lenses, one plan

Unchanged from parent contract:

1. Actual → history cumulative (chain).
2. Set path in cumulative (default: linear handoff → network target by Dec).
3. Invert to monthly via running-mean formula (see Math).
4. Chain → stores via `allocateStorePlansFromChain`; store cum = history running mean.

### L1 — Live preview (every drag frame)

- On each pointer-move frame, update the **atomic plan package** locally.
- No Run / Calculate button; no waiting on the server for the plan path.
- `pointerup` / `pointercancel` finalizes the same recompute (no deferred “apply”).
- Preview must update **related Slope plan surfaces**, not only the two lines:
  - Network Cumulative Plan
  - Network Monthly Plan
  - Store Inspect Slope Plan (monthlies + cum) derived from the same package
- Simulation / unreachable chips stay on live `simulate` (Plan ≠ Simulation).
- Legacy At-Risk (`draftPlan` five%) is **out of Phase 1 live scope** — do not
  pretend it tracks Slope pins.

### L2 — Allocation feasibility in Phase 1 (atomic package)

After trajectory recompute, run `allocateStorePlansFromChain` (current limits:
floor/ceiling, priority). Equal-weight store mean must match chain monthly
within ε for every future month.

- If allocate cannot realize the chain plan → **reject the edit entirely**.
- Never show a new network plan next to stale store plans / Inspect plan.
- Outward result is either a full package `{ planYs, planCumYs, byStore, pins }`
  or an error with reason; no partial apply.

**Sync rule:** trajectory + allocate in the **same frame**. Do not throttle
network lines ahead of allocate. If allocate ever becomes async, keep panels on
`lastGood` and show `pending` until the full package is ready (or ignore stale).

### L3 — Pin math and multi-pin behaviour

**Aggregation (mandatory):** exactly the current running-mean invert:

```text
m_k = (n+k)·c_k − (n+k−1)·c_{k−1}
```

Reuse `monthlyFromCumulativePath` (or identical arithmetic). `n` starts at
`handoffCount` and increments each horizon month — **not** equal month weights.
Tests must cover non-trivial `handoffCount` (e.g. 1, 3, 12, 14).

**Default path (no pins):** identical to `buildHistoryCumLinearPlan` /
`linearCumulativePathToTarget` → invert (regression lock).

**With pins:** piecewise-linear cumulative between anchors  
`handoffCum → pin cum(s) → network target @ Dec`, then one running-mean invert
over the full horizon (do not reset count per segment).

| Situation | Rule |
|-----------|------|
| Drag cumulative @ month t (no pin) | Add `{ kind: 'cumulative', monthIndex: t, value }` |
| Drag cumulative @ t (pin exists) | **Replace** value for that month (one pin per month) |
| Drag monthly @ t | Pin `{ kind: 'monthly', … }`; derive `C_t` from running mean; continue path to target |
| Cum pin and monthly pin requested for same t | **Replace** — newest drag wins kind+value (still one pin per month). API that passes two kinds for one month without replace → `pin_conflict` |
| Pin on fact / ≤ cutover / after Dec | Reject `invalid_month` |
| Monthly outside [floor, ceiling] after invert | Reject `out_of_bounds` |
| EOY cumulative ≠ target | Reject `target_miss` |
| Allocate mean ≠ chain level | Reject `allocate_infeasible` |

### L4 — Concurrency and rollback

- Reset plan / change target / new Run / as_of / panel refresh / unmount:
  cancel in-flight drag, bump generation, ignore stale results.
- Feasibility or other reject during drag: set `preview = lastGood`, show error;
  do not keep a half-applied pin set.
- `lastGood` = last package that passed trajectory + allocate.

### L5 — Save (Phase 1 behaviour)

- Phase 1 does **not** change Save freeze payload (still simulation baseline per
  parent non-goal, until Phase 2).
- If draft has unsaved Slope pins (`dirty`): **block Save** (or equivalent) and
  explain that Save would still freeze the simulation baseline, not the edited
  path — Phase 2 will persist the edited package.

---

## Non-goals

| Item | Phase |
|------|--------|
| OR-Tools / new solver | Never without a documented gap |
| Migrate charts off Plotly to SVG+D3 | Not if Plotly can be extended |
| Drag Simulation forecast | Never (this experiment) |
| Persist edited plan on Save | Phase 2 |
| TTS planner parity | Out of scope |
| Live-update legacy At-Risk from Slope pins | Out of Phase 1 |

---

## Architecture (Phase 1)

```text
Pointer drag (Plotly panels)
        │
        ▼
replacePin(pins, kind, month, y)
        │
        ▼
recomputeTrajectory(pins)     ← linear segments + monthlyFromCumulativePath
        │
        ▼
allocateStorePlansFromChain   ← same frame; gate
        │
        ├─ ok  → preview = package; panels bind to preview
        └─ err → preview = lastGood; banner reason
        │
pointerup → same recompute; on ok: lastGood = preview
```

**Suggested modules**

| Module | Role |
|--------|------|
| `web/src/components/planner/planTrajectoryPins.ts` | Pure pin → package / error |
| `planTrajectoryPins.test.ts` | Math + allocate gate + conflicts |
| Draft hook or store slice | `pins`, `lastGood`, `preview`, `status`, `error`, `generation` |
| `SlopeCumulativePanel` / `SlopeMonthlyPanel` | Y-only drag on future Plan markers |
| `PlannerPage` / Inspect wiring | Bind layers from `preview \|\| baseline`; Save guard |

**Backend:** no change required for Phase 1 draft recompute.

---

## Implementation steps

### Step 0 — Spec (this doc)

- [x] Contract written under `docs/contracts/`
- [x] Progress reports appended below as steps complete

### Step 1 — Pure math + allocate gate

- [x] `planTrajectoryPins.ts` API (`Pin`, `recompute…`, error codes)
- [x] pins=[] ≡ current linear plan
- [x] Tests: real `handoffCount`, multi-pin, replace, conflict, bounds, `allocate_infeasible`

### Step 2 — Draft state + layer overlay

- [x] Draft state (`lastGood` / `preview` / dirty / generation)
- [x] Apply package onto network + store Slope layers atomically
- [x] Reset on target / as_of / Run / explicit Reset
- [x] Save blocked when dirty + i18n tip

### Step 3 — Plotly live drag

- [x] Cumulative panel: drag → cumulative pin; live package update
- [x] Monthly panel: drag → monthly pin; same package
- [x] Concurrency cancel; error rollback to lastGood
- [x] Unit tests for recompute path; Plotly hit-testing needs manual check

### Step 4 — Phase 1 hardening / DoD review

- [x] Draft hook tests (commit / reject rollback / context reset)
- [x] Dirty includes in-progress preview; target change resets pins
- [x] Avoid Plotly `onUpdate` drag rebind thrash
- [x] Phase 2 Save approach decided (see below)
- [ ] Manual UI DoD on live Planner (operator checklist)

### Step 5 — Phase 2 (optional, separate)

- [ ] Persist edited package on Save (**Option A**: client sends monthlies)
- [ ] Update parent contract Save non-goal
- [ ] API / schema / tests

---

## Definition of Done — Phase 1

- [ ] Drag updates cumulative + monthly **and** store Inspect Plan from one package per frame
- [ ] No “new network + old store plans” state
- [ ] Allocate failure → full reject + reason + rollback to lastGood
- [ ] Pin rules covered by tests (including non-equal running-mean weights)
- [ ] Run / target / reset cancel drag; stale ignored
- [ ] Simulation unchanged by plan drag
- [ ] Save blocked or explicitly explained when dirty
- [ ] No Run button required to recompute plan

---

## Error codes (Phase 1)

| Code | Meaning |
|------|---------|
| `invalid_month` | Pin outside editable future horizon |
| `out_of_bounds` | Monthly (or cum) outside [floor, ceiling] |
| `target_miss` | Path does not end on network target |
| `pin_conflict` | Two kinds for one month in API input |
| `allocate_infeasible` | Stores cannot realize chain monthly under limits |
| `empty_horizon` | No future months to plan |

---

## PR sequence

1. This spec + Step 1 (math + tests)  
2. Step 2 (draft state + wiring; debug controls OK)  
3. Step 3 (Plotly drag + concurrency + Save guard)  
4. Step 4 DoD / Phase 2 decision  

---

## Implementation progress / reports

### Report — Step 0 (spec)

**Date:** 2026-11-19  
**Branch:** `exp/slope-plan-point-drag`  
**Done:**

- Wrote this SPEC from agreed plan v2 (live preview, atomic allocate gate,
  pin rules, concurrency, Save guard, Phase 2 split).
- Location: `docs/contracts/slope_plan_point_drag.md`.

### Report — Step 1 (math + allocate gate)

**Date:** 2026-11-19  
**Done:**

- Added `web/src/components/planner/planTrajectoryPins.ts`:
  `replacePin`, `normalizePins`, `buildPinnedHorizonPath`,
  `recomputeSlopePlan`, `assertAllocateFeasible`.
- Uses exact `monthlyFromCumulativePath` / `linearCumulativePathToTarget`.
- Tests: 13 cases in `planTrajectoryPins.test.ts` (all green) including
  handoffCount 12/14, pin_conflict, allocate_infeasible, empty_horizon.

### Report — Step 2 (draft + Save guard)

**Date:** 2026-11-19  
**Done:**

- `useSlopePlanDraft` + `slopePlanRecompute` (overlay + sim→recompute).
- `PlannerPage`: display layers from draft package; dirty banner + Reset;
  Save disabled when dirty (`planner.savePlanBlockedByPinsTip`).
- `StoreAuditDrawer` accepts `slopeStorePlanOverride` so Inspect Plan stays
  atomic with network package.
- Run success calls `resetPins()`.

### Report — Step 3 (Plotly live drag)

**Date:** 2026-11-19  
**Done:**

- `slopePlanDrag.ts` — pointer Y-drag on traces with `meta.slopePlanDrag`.
- Wired on `SlopeCumulativePanel` (kind cumulative) and `SlopeMonthlyPanel`
  (kind monthly); `CumulativeSlopeHeroChart` passes handlers.
- Live preview via `previewDrag` / commit via `endDrag`; reject → lastGood +
  error banner.
- `tsc -b` clean; unit tests for pins + recompute green.

### Report — Step 4 (hardening + Phase 2 decision)

**Date:** 2026-11-19  
**Done:**

- `useSlopePlanDraft.test.ts` — commit/dirty/reset, reject keeps lastGood,
  sim target context reset.
- Draft: refs for rapid drag; dirty while previewing; UI `target` change →
  `resetPins`; drop Plotly `onUpdate` rebind.
- **Phase 2 decision: Option A** — on Save, client sends the edited
  `network_monthly_target` (+ store rows from the same allocate package).
  Server persists without re-solving pins. Porting pin math to Python only if
  we later need server-side authority (Option B).

**Remaining:** manual UI checklist on `npm run dev` (drag both panels,
Inspect sync, Save blocked, Reset / Run).

**Verify:**

```powershell
cd web
npm run test:run -- src/components/planner/planTrajectoryPins.test.ts src/components/planner/slopePlanRecompute.test.ts src/components/planner/useSlopePlanDraft.test.ts
npm run dev
# Planner → drag blue Plan markers after cutover on both panels
```
