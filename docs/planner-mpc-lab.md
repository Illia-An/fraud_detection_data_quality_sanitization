# Planner MPC Lab — experiment brief

**Status:** side experiment (not in Fraud/Planner product app tree)  
**Goal:** compare today’s heuristic allocator (`plan_five_percent`) with an **experimental MPC-style solver** on the same tasks, then explore capabilities MPC unlocks (cost weights, soft target, receding replan, optional path-tracking).  
**Levels:** A (static dual-solve) → B (cost knobs + hard cases) → C (receding replay + optional track-required-path)  
**UI follow-up (owner):** after A/B(/C) math works, put a **Hero-like Evaluation chart** on top (see §6) and judge the whole package by eye.  
**Product context (frozen separately):** allocator in `src/planner/five_percent.py`, plan contract in `backend/plan_schemas.py`, Evaluation Hero in `web/src/components/planner/HeroSimulationChart.tsx` + `heroEvaluationSeries.ts`.

---

## 1. Why a separate mini-project

| Keep in product repo | Do here in the lab |
|----------------------|--------------------|
| `plan_five_percent` as default source of truth | MPC / QP / simple horizon optimizer |
| Product Hero (Plotly), i18n, panel, `/api/v1/plans` | Synthetic baselines + dual compare UI |
| Evaluation required-pair as independent benchmark | Optional “track required path” *mode* only |
| PR / CI noise | Throwaway spikes |

**Rule:** lab may fork formulas and add solver deps; product stays on heuristic until a capability proves useful enough for an **opt-in experimental backend** (`solver: "heuristic" | "mpc"`), not a silent replace.

**Related lab (do not merge):** `docs/planner-hero-scrub-lab.md` — gesture/scrub on required-pair only. This MPC lab is about **allocation / control**, not as-of scrub gestures (though §6 Hero chrome can reuse the same visual grammar).

---

## 2. What we are simulating (semantics)

### 2.1 Shared planning problem (product parity)

Same meaning as TASK-15 Phase A:

| Concept | Meaning |
|---------|---------|
| **Baseline** | Store → cleansed `five_percent` at reference month |
| **Chain** | Equal-weight mean `1/n` (product lock — **no volume**) |
| **Target** | Higher-is-better chain target in `[0, 100]` |
| **Horizon** | `H` months after reference (1..12) |
| **Controls** | Per-store monthly score lifts, capped by `max_monthly_improve` |
| **Bounds** | `floor=0`, `ceiling=100` |
| **Output** | `chain_trajectory`, per-store `projections`, `feasible`, `current_chain`, `final_chain` |

### 2.2 Two solvers (must share I/O shape)

| Solver | Role |
|--------|------|
| **Heuristic** | Port or faithfully reimplement `plan_five_percent` (priority/gap, capacity, trajectory weights, redistribute loop) |
| **MPC** | Finite-horizon optimize: choose monthly lifts to hit (or soft-hit) target under caps; expose cost knobs |

**Contract target (align fields with product):**

```ts
// Lab PlanOut — mirror backend/plan_schemas.py FivePercentPlanOut
interface MonthScore { year: number; month: number; score: number }
interface StoreProjection { store_id: number; months: MonthScore[] }
interface PlanOut {
  metric_id: 'five_percent'
  unit: '%'
  direction: 'higher_is_better'
  target: number
  current_chain: number
  required_change: number
  final_chain: number
  feasible: boolean
  chain_trajectory: MonthScore[]
  projections: StoreProjection[]
}
```

Optional lab-only compare block (not in product API):

```ts
interface CompareMetrics {
  totalEffort: number          // sum of positive month-to-month lifts
  maxMonthlyStep: number       // max single-store single-month lift
  storeSpread: number          // e.g. stdev of total lifts across stores
  shortfallPp: number          // max(0, target - final_chain)
  pathGapToRequired?: number   // if required pair computed: L2/mean |draftCum - requiredCum|
}
```

### 2.3 Evaluation / required pair (display + optional MPC mode)

Same grammar as product Hero short-window (−3) required pair (read-only inspiration):

- `web/src/components/planner/heroEvaluationSeries.ts`
  - `CUMULATIVE_WINDOW_LAG_MONTHS = 3`
  - `linearCumulativePathToTarget`
  - `monthlyFromCumulativePath`
  - `cumulativeMeanSeries`
  - `buildHeroEvaluationSeries`

```text
# Short-window running mean of monthly facts → startCum at as-of
# Linear cumulative path to target over H steps:
c_k = startCum + (target - startCum) * k / H
# Invert to monthlies:
m_k = (n+k)*c_k - (n+k-1)*c_{k-1}
```

**Default:** required pair is a **benchmark overlay**, not the MPC objective.  
**Level C optional mode:** `trackRequiredPath=true` adds a cost term so draft cumulative tracks that path — must be clearly labeled.

---

## 3. Experiment levels

### A — Static dual-solve (~0.5–1 day)

- Vite + React + TypeScript lab (or Vite + TS + minimal HTML).
- 3–5 synthetic fixtures (§7).
- Run **heuristic** and **MPC** on the same `PlanRequest`-like input.
- Show dual network trajectories + KPI strip (`final_chain`, `feasible`, effort, shortfall).
- No receding loop yet; MPC can be a simple QP or projected iterative method.

**Success:** on “easy gap” both hit target; deltas (effort / spread) are visible and explainable.

### B — Cost knobs + hard cases (~1–2 days)

- UI knobs for MPC only:
  - `w_effort`, `w_shortfall`, `w_unfairness` (or equivalent)
  - hard vs soft target
  - same product knobs for *both* solvers: `target`, `horizon`, `max_monthly_improve`, `trajectory` (heuristic), optional trajectory *shape prior* for MPC
- Fixtures: infeasible, many stores already at/above target, front-loaded stress.
- Side-by-side heatmap (store×month) optional but valuable.

**Success:** ≥1 case where MPC clearly wins on a stated objective (e.g. lower peak step at same hit-target) **or** soft-target behavior is obviously useful.

### C — Receding replay + path-tracking (~+1 day)

- Month slider: apply first control month → synthesize “actual” (plan + small noise or exact) → re-solve remaining horizon (classic MPC).
- Compare **open-loop** (full plan once) vs **closed-loop** (replan each step).
- Toggle **Track required path** (off by default).
- Badge: “Simulation — not cleansed fact”.

**Success:** closed-loop reduces shortfall under noise vs open-loop on at least one fixture; path-tracking mode is optional and not confused with default MPC.

---

## 4. Create the environment

### 4.1 Location (recommended)

Outside this product app tree, sibling folder:

```text
C:\McDonalds\01_SOURCES(clean_code)\
  Fraud_Fetection_Data_Quality_Sanitization\   # product (this repo)
  planner-mpc-lab\                             # THIS experiment
```

Do **not** put the lab under `web/` of the product app.

### 4.2 Prerequisites

- Node.js 20+ (LTS)
- npm 10+
- Browser: Chrome/Edge
- Optional later: Python 3.13 + `uv` if MPC solver is a tiny FastAPI/stdio sidecar (not required for A)

### 4.3 Scaffold (Vite + React + TS)

```bash
cd "C:\McDonalds\01_SOURCES(clean_code)"
npm create vite@latest planner-mpc-lab -- --template react-ts
cd planner-mpc-lab
npm install
npm run dev
```

### 4.4 Suggested folder layout

```text
planner-mpc-lab/
  README.md
  docs/
    EXPERIMENT.md              # copy of this brief (optional)
  package.json
  src/
    main.tsx
    App.tsx
    lab/
      types.ts                 # PlanRequest-like, PlanOut, CompareMetrics
      fixtures.ts              # scenarios in §7
      solvers/
        heuristic.ts           # port of plan_five_percent
        mpc.ts                 # experimental optimizer
        index.ts               # runBoth(input) → { heuristic, mpc, compare }
      eval/
        requiredPair.ts        # optional: linear path + invert (Hero grammar)
      compare/
        metrics.ts             # effort, max step, spread, shortfall, path gap
      ui/
        ScenarioPicker.tsx
        ProductKnobs.tsx       # target, horizon, maxMonthly, trajectory…
        MpcKnobs.tsx           # cost weights, soft/hard, track path
        DualTrajectoryChart.tsx
        CompareKpiStrip.tsx
        StoreHeatmap.tsx       # optional B+
        HeroOverlay.tsx        # §6 — add after math A works
        RecedingReplay.tsx     # level C
    styles.css
  public/
```

### 4.5 Git for the lab (optional)

```bash
cd planner-mpc-lab
git init
echo "node_modules/" >> .gitignore
echo "dist/" >> .gitignore
git add .
git commit -m "chore: scaffold Planner MPC lab (A/B/C experiment)"
```

Keep lab git **separate** from product remotes unless you later vendor a proven solver.

---

## 5. Libraries — what to use and what to skip

### Recommended (minimal)

| Package | Why |
|---------|-----|
| **Vite + React + TypeScript** | Matches product front language; fast sandbox |
| **SVG chart first** | Dual trajectories + legend without Plotly weight |

### Solver options (pick one for A; document choice)

| Approach | When |
|----------|------|
| **Pure TS projected gradient / coordinate descent** | Fastest to ship A; good enough for 8–20 stores × ≤12 months |
| **`quadprog` / small QP in TS** | If you want a real quadratic cost |
| **Python sidecar + OSQP/cvxpy** | Only if TS optimizer fights you; keep I/O = `PlanOut` JSON |

### Explicitly skip for v1

| Package / thing | Why |
|-----------------|-----|
| Product `web/` MUI/Plotly copy-paste | Heavy; port Hero *look* later (§6) with SVG |
| Volume weights / TTS / DB | Violates product locks for this experiment |
| Full StorePlanner / counterpart-pool parity | Out of scope (TASK-15 non-goal) |
| Merging into `/api/v1/plans` | Only after lab decision log says Keep |

---

## 6. Hero-like UI (owner follow-up — describe for implementers)

After dual-solve works, **dress the lab** with a chart that reads like product **Hero evaluation**, so you can judge “what I end up with” visually.

### 6.1 Product reference (read-only)

| Piece | Path |
|-------|------|
| Network Hero | `web/src/components/planner/HeroSimulationChart.tsx` |
| Series builder | `web/src/components/planner/heroEvaluationSeries.ts` |
| Legend + tips | `web/src/components/planner/EvaluationLegend.tsx` (`HERO_EVALUATION_LEGEND`) |
| Crosshair helpers | `web/src/components/planner/heroChartCrosshair.ts` |
| Store zoom grammar | `web/src/components/planner/StoreHeroEvaluationChart.tsx` |

Product Hero is Plotly; lab should prefer **SVG** with the same *series roles*, not a pixel clone.

### 6.2 Series to show in lab Hero overlay

For **one selected solver** (toggle Heuristic | MPC), plus shared fact/required:

| Series | Role (match product meaning) | Visual hint |
|--------|------------------------------|-------------|
| **Fact** | Synthetic monthly network “cleansed” ≤ as-of | Black solid |
| **Required monthly** | Inverted linear cum path to target | Gray dashed |
| **Required cumulative** | Cum of window facts + required monthlies → target | Gray solid |
| **Draft / plan monthly** | Solver `chain_trajectory` (network) | Blue |
| **Plan cumulative** | Short-window + draft cum (green grammar) | Green |
| **Target** | Horizontal | Dotted |
| **As-of** | Vertical cutover | Dashed vertical |
| **Window start (−3)** | Optional vertical | Lighter vertical |
| **Slack band** | Optional ±pp around draft (soft envelope, **not** CI) | Band |

**Lab addition (dual mode):** when comparing, either (a) two draft lines (heuristic vs MPC) with distinct colors, or (b) one draft + ghost of the other. Always show which solver is “active”.

### 6.3 Chrome / interaction (lab Hero)

Minimum:

1. Solver toggle: Heuristic | MPC | Both  
2. Legend click → show/hide series (same UX idea as product `EvaluationLegend`)  
3. Readout: as-of, current_chain, target, final_chain, feasible, shortfall, totalEffort  
4. Badge: `Lab simulation · equal-weight chain · not production`

Optional (nice, not blocking):

- Horizontal scroll if many months (`HERO_PX_PER_PERIOD ≈ 44` is a product hint)  
- Hover crosshair (month + values)  
- Fixed plot height ~340px like `HERO_PLOT_HEIGHT_PX`

### 6.4 Copy rules (avoid lying to yourself)

- Cone/band = **allocation slack / envelope**, not statistical confidence.  
- Gray required ≠ committed plan unless **Track required path** is on.  
- Heuristic draft and MPC draft **may diverge**; that is the point of the lab.

### 6.5 Success for the UI pass

Anyone can open the lab and answer:

1. Did both solvers hit target on the easy fixture?  
2. Where does MPC spend less effort / peak / spread?  
3. Does the Hero grammar still read as fact → as-of → required vs draft?

---

## 7. Fixtures (current product tasks + stress)

Keep fixtures small (6–12 stores, 4–8 horizon) so SVG stays readable.

### F1 — Easy gap (parity)

- Chain ~70, target 75, horizon 6, `max_monthly_improve=4`  
- Mixed stores below target  
**Expect:** both `feasible=true`, final ≥ target.

### F2 — Infeasible

- Chain ~72, target 90, horizon 3, `max_monthly_improve=2`  
**Expect:** both `feasible=false` (or MPC soft-target shows shortfall trade).

### F3 — Many at/above target

- Half stores ≥ target; need `growth_factor`-like room on strong stores (heuristic) vs MPC cost on lifting strong stores  
**Expect:** visible strategy difference.

### F4 — Trajectory stress

- Same baseline/target; compare heuristic `uniform` vs `front_loaded` vs `accelerated`  
- MPC: with/without shape prior  
**Expect:** early vs late effort patterns differ.

### F5 — Receding noise (level C)

- F1 params; each applied month add noise ±0.5–1.0 pp on chain or per-store  
**Expect:** closed-loop MPC shortfall ≤ open-loop on average (document seed).

Example seed shape:

```ts
export const F1 = {
  id: 'easy-gap',
  reference_year: 2025,
  reference_month: 6,
  horizon: 6,
  target: 75,
  params: {
    trajectory: 'uniform' as const,
    trajectory_power: 2,
    priority_power: 1,
    max_monthly_improve: 4,
    growth_factor: 0.5,
  },
  baseline_rows: [
    { store_id: 10, five_percent: 66 },
    { store_id: 20, five_percent: 70 },
    { store_id: 30, five_percent: 72 },
    { store_id: 40, five_percent: 68 },
    { store_id: 50, five_percent: 74 },
  ],
  // optional synthetic history for Hero fact ≤ as-of
  historyNetworkMonthly: [68, 69, 70, 71, 70, 70],
}
```

---

## 8. How to look at the result (checklist)

After `npm run dev`:

**Level A**

1. Select F1 → both feasible; dual trajectories end near/at target.  
2. Compare KPI strip: effort / max step / spread.  
3. Select F2 → both show infeasible or MPC soft shortfall; no crash.  
4. Confirm `PlanOut` shapes match (§2.2).

**Level B**

5. Raise `w_effort` → MPC flatter lifts / lower totalEffort (may risk shortfall if soft).  
6. Hard target on F2 → infeasible signal clear.  
7. Soft target on F2 → finite plan with visible shortfallPp.  
8. Heatmap (if present): who carries the load under heuristic vs MPC.

**Level C**

9. Receding replay on F5: open-loop vs closed-loop shortfall.  
10. Track required path ON → draft cum closer to gray; badge/mode label visible.  
11. Track OFF → gray is benchmark only again.

**Hero UI pass (§6)**

12. Fact / as-of / required / draft readable; legend toggles work.  
13. Solver toggle updates draft without resetting fixture.  
14. No confusion between required gray and MPC/heuristic draft.

**Pass criteria:** another engineer can run A in <1 day from this doc and explain one Keep/Drop for “MPC as experimental backend”.

---

## 9. Mapping back to product (later)

| Lab finding | Product follow-up |
|-------------|-------------------|
| MPC wins on effort/peak with same hit-rate | Opt-in `solver=mpc` behind experimental flag; default stays heuristic |
| Soft target useful | New plan param; surface shortfall in Simulation KPIs |
| Receding replay valuable | Wire to monitoring as-of / new panel months (replan), not lab noise |
| Track required path useful | Sandbox mode only; do **not** make gray the silent objective |
| Hero dual-draft confuses | Keep single draft in prod; compare only in lab/admin |
| Heuristic parity bugs found while porting | Fix `five_percent.py` with tests — independent win |

**Do not** merge lab UI wholesale. Port: (1) solver module + contract flag, (2) any proven knobs, (3) copy that preserves Evaluation vs allocation separation.

Suggested product integration sketch (future, not lab work):

```text
POST /api/v1/plans
  body.params.solver?: "heuristic" | "mpc"   # default heuristic
  response: same PlanResponse
```

---

## 10. Out of scope for this lab

- FastAPI product wiring / real `SanitizedPanel`  
- DB Save / TTS / KPI All / volume-weighted chain  
- HE/EN i18n parity  
- Playwright in product CI  
- Replacing production Plotly Hero  
- Full Angular StorePlanner parity  
- Scrub/drag as-of gestures (see `planner-hero-scrub-lab.md`) unless you explicitly combine labs later  

---

## 11. One-page runbook

```bash
# create
cd "C:\McDonalds\01_SOURCES(clean_code)"
npm create vite@latest planner-mpc-lab -- --template react-ts
cd planner-mpc-lab
npm install

# implement order
# 1) types + F1/F2 fixtures
# 2) heuristic port (match five_percent behavior on F1/F2)
# 3) mpc v0 + compare metrics
# 4) DualTrajectoryChart + CompareKpiStrip
# 5) B knobs + F3/F4
# 6) HeroOverlay (§6)
# 7) C receding + optional trackRequiredPath

# run
npm run dev
# open http://localhost:5173
```

**Heuristic reference (product):**

- `src/planner/five_percent.py` — `plan_five_percent`, `trajectory_weights`
- Tests: `tests/test_planner_five_percent.py` (behavioral oracle while porting)
- API shape: `backend/plan_schemas.py`

---

## 12. Decision log (fill while experimenting)

| Date | Level | Observation | Keep / Drop / Defer |
|------|-------|-------------|---------------------|
| | A | Dual-solve parity on F1 | |
| | A | Infeasible handling F2 | |
| | B | Cost weights change strategy usefully? | |
| | B | Soft target worth a product param? | |
| | C | Closed-loop > open-loop under noise? | |
| | C | Track required path: insight or confusion? | |
| | UI | Hero overlay clarifies or clutters? | |
| | — | Promote MPC to experimental backend? | |

---

## 13. Agent implementation notes (for the agent running this brief)

1. **Minimal diff mindset:** build only lab tree; do not modify product files unless fixing a discovered heuristic bug (then prefer a separate product PR).  
2. **Verify:** run lab `npm run build` (and unit tests if you add `vitest` for solvers).  
3. **Parity:** before claiming MPC is better, prove heuristic port matches product on F1/F2 within ~0.05–0.1 pp on chain trajectory (or document intentional drift).  
4. **Default MPC objective (suggested v0):** soft quadratic — minimize  
   `w_effort * Σ u² + w_unfair * variance(store totals) + w_shortfall * shortfall²`  
   subject to box constraints on monthly lifts; hard-target mode = large `w_shortfall` or explicit constraint when feasible.  
5. **Equal weights only** unless decision log explicitly opens volume weights.  
6. When Hero overlay is added, keep required-pair code pure and testable (`requiredPair.ts`), same as product’s separation of Evaluation math from allocation.  
7. Deliverable for the human owner: runnable lab + filled decision log rows for A and UI pass; B/C as time allows.

---

*End of brief. Spec for standing up an MPC-vs-heuristic planner lab, simulating current allocation tasks, probing extra MPC capabilities, and optionally dressing results in a Hero-like Evaluation chart — without cluttering the product tree.*
