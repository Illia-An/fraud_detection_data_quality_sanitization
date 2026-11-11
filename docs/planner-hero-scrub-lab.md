# Planner Hero Scrub Lab — experiment brief

**Status:** side experiment (not in Fraud/Planner product app tree)  
**Goal:** interactive “predictive” infographic for the **required monthly + required cumulative** pair: move a reference point, watch dependent curves update live.  
**Levels:** A (static/slider) → B (React + drag as-of) → C (+ Euclidean / what-if Y)  
**Product context (frozen separately):** branch `exp/planner-required-monthly-hero` in this repo.

---

## 1. Why a separate mini-project

| Keep in product repo | Do here in the lab |
|----------------------|--------------------|
| Required pair math on Network Hero (committed on exp branch) | Scrubber, ghost, drag in plane |
| i18n, Plotly Hero, API, panel | Synthetic months only |
| PR / CI noise | Throwaway UX spikes |

**Rule:** lab may fork formulas; product stays clean until a gesture proves useful.

---

## 2. What we are simulating (semantics)

Same meaning as current Hero gray pair (short-window −3 grammar):

| Series | Role |
|--------|------|
| **Black** | Monthly fact ≤ as-of |
| **Gray dashed** | Required monthly after as-of (to hit target) |
| **Gray solid** | Cumulative of (window facts + required monthlies) → target |
| **Purple** (optional in lab) | Full-history cumulative (contrast only) |
| **Target** | Horizontal reference |
| **Vertical as-of** | Cutover |
| **Vertical −3 window** (optional) | Start of short window |

**Linked pair:** both grays share one handoff (`startCum`, `n` from as-of−lag … as-of). Changing as-of / lag / target recomputes **both**.

**Not in v1 lab:** draft blue/green, orange duplicate (optional), API, real panel.

### Core formulas (copy from product or reimplement)

```text
# Short-window running mean of monthly facts → startCum at as-of
# Linear cumulative path to target over H horizon steps:
c_k = startCum + (target - startCum) * k / H

# Invert to monthlies:
m_k = (n+k)*c_k - (n+k-1)*c_{k-1}

# Required cumulative = running mean of [window monthlies…, m_1…m_H]
```

Product references (read-only inspiration):

- `web/src/components/planner/heroEvaluationSeries.ts`
  - `CUMULATIVE_WINDOW_LAG_MONTHS = 3`
  - `linearCumulativePathToTarget`
  - `monthlyFromCumulativePath`
  - `cumulativeMeanSeries`
  - `buildHeroEvaluationSeries` (required pair)

---

## 3. Experiment levels

### A — Static / slider mock (~0.5–1 day)

- HTML or minimal React page.
- Synthetic timeline (8–12 months).
- Range input = as-of index.
- Recompute gray pair on `input`.
- No drag on chart.

**Success:** moving as-of clearly moves dash + solid together toward target.

### B — React lab + drag as-of (~1–2 days)

- Vite + React + TypeScript.
- SVG chart (preferred) or Canvas.
- Draggable as-of handle on X (snap to month).
- Optional **ghost**: previous as-of pair at low opacity while dragging.
- Readout: as-of label, startCum, next required monthly, gap to target.

**Success:** pointer scrub feels like a “predictive” tool; pair stays consistent.

### C — Euclidean / what-if handle (~+0.5–1 day)

- Second handle or mode: drag in (time, score) plane.
- **X** = as-of (or locked); **Y** = hypothetical `startCum` (not fact).
- Label clearly: “What-if handoff” vs “Fact handoff”.
- Pair recomputes from overridden `startCum` + same `n` / horizon / target.

**Success:** manager can ask “if we stood at Y, what monthlies would we need?” without confusing it with history.

---

## 4. Create the environment

### 4.1 Location (recommended)

Outside this product app tree, sibling folder:

```text
C:\McDonalds\01_SOURCES(clean_code)\
  Fraud_Fetection_Data_Quality_Sanitization\   # product (this repo)
  planner-hero-scrub-lab\                      # THIS experiment
```

Do **not** put the lab under `web/` of the product app.

### 4.2 Prerequisites

- Node.js 20+ (LTS)
- npm 10+ (or pnpm/yarn — pick one and stick to it)
- Git (optional but useful)
- Browser: Chrome/Edge

### 4.3 Scaffold (Vite + React + TS)

```bash
cd "C:\McDonalds\01_SOURCES(clean_code)"
npm create vite@latest planner-hero-scrub-lab -- --template react-ts
cd planner-hero-scrub-lab
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### 4.4 Suggested folder layout

```text
planner-hero-scrub-lab/
  README.md                 # short run instructions
  docs/
    EXPERIMENT.md           # copy of this brief (optional)
  package.json
  src/
    main.tsx
    App.tsx
    lab/
      math.ts               # cumulativeMean, linearPath, monthlyFromPath
      syntheticData.ts      # months + fact scores + target + horizon
      series.ts             # buildRequiredPair(asOfIndex, lag, target, …)
      HeroScrubChart.tsx    # SVG + pointer handlers
      types.ts
    styles.css              # minimal; avoid heavy UI kits at first
  public/
```

### 4.5 Git for the lab (optional)

```bash
cd planner-hero-scrub-lab
git init
echo "node_modules/" >> .gitignore
echo "dist/" >> .gitignore
git add .
git commit -m "chore: scaffold Hero scrub lab (A/B/C experiment)"
```

Keep lab git **separate** from product remotes unless you later decide to vendor it.

---

## 5. Libraries — what to use and what to skip

### Recommended (minimal)

| Package | Why |
|---------|-----|
| **Vite + React + TypeScript** | Fast sandbox, matches product front-end language |
| **No chart lib at first** | Full control over drag handles; SVG is enough for ~12 points |

Optional tiny helpers (only if needed):

| Package | When |
|---------|------|
| `d3-scale` | Nice x/y scales without full D3 |
| `d3-array` | extent / nice ticks |

Install example:

```bash
npm install d3-scale
npm install -D @types/d3-scale
```

### Explicitly optional / skip for v1

| Package | Why skip initially |
|---------|-------------------|
| **plotly.js / react-plotly.js** | Heavy; drag of custom handles is awkward |
| **recharts / chart.js / echarts** | Fine for display; poor for “move point → recompute grammar” |
| **MUI / Tailwind** | OK for polish later; not required to validate the idea |
| **Full D3** | Overkill if you only need scales + SVG paths |

### When to reconsider a chart library

Only if after B/C you need production polish (zoom, export, a11y) **and** you already know the interaction model. The experiment’s value is the **gesture + math binding**, not the chart brand.

---

## 6. Interaction design (lab UI)

### Minimum controls

1. **As-of scrubber** — range input synced with chart handle  
2. **Lag** — default 3; try 2 / 6  
3. **Target** — number input 0–100  
4. **Horizon H** — months after as-of used for path  

### Chart chrome

- X: month labels  
- Y: score %  
- Fact polyline (black) ≤ as-of  
- Required monthly (gray dash + diamonds) ≥ as-of  
- Required cumulative (gray solid) ≥ as-of  
- Target dotted horizontal  
- As-of vertical (draggable in B)  
- Optional window-start vertical  

### Ghost (B+)

On pointer down, freeze previous series as ghost; on pointer up, clear or keep last ghost.

### What-if (C)

Toggle “Fact handoff” vs “What-if Y”:  
- Fact: `startCum` from data  
- What-if: `startCum` from handle Y  

Show a badge so viewers never confuse simulation with cleansed fact.

---

## 7. Synthetic data (enough to “see how it looks”)

Example seed (edit freely):

```ts
export const MONTHS = [
  '2025-01','2025-02','2025-03','2025-04','2025-05',
  '2025-06','2025-07','2025-08','2025-09','2025-10',
];
export const FACTS = [68, 70, 71, 72, 69, 74, 73, 75, 76, 74];
export const TARGET = 80;
export const DEFAULT_LAG = 3;
export const HORIZON = 4; // months after as-of
```

Pick default as-of near the middle (e.g. index of `2025-06`) so window and horizon are both visible.

---

## 8. How to look at the result (checklist)

After `npm run dev`:

1. Open lab URL; confirm black facts and target render.  
2. Move as-of **left** → shorter/longer history in window; gray pair should **jump** (new startCum).  
3. Move as-of **right** → fewer horizon steps or different path steepness.  
4. Raise target → both grays steepen; solid still ends on target.  
5. Change lag 3→6 → pair changes even if as-of fixed.  
6. (B) Drag handle on chart; slider stays in sync.  
7. (B) Ghost visible while dragging.  
8. (C) Drag Y; readout shows what-if startCum; pair updates; badge visible.  

**Pass criteria:** anyone can scrub once and explain: “dashed = required months, solid = cum if we hit those months, both from the window at as-of.”

---

## 9. Mapping back to product (later)

| Lab finding | Product follow-up |
|-------------|-------------------|
| As-of scrub is valuable | Wire Hero `asOf` to a first-class control (fix monitoring override) |
| Ghost helps | Implement ghost on as-of change (handoff item) |
| What-if Y confuses | Keep out of prod or gate behind “Sandbox” |
| Orange ≈ gray solid | Prefer variant A: drop orange, keep required pair |

**Do not** merge lab UI wholesale. Port: (1) interaction contract, (2) any math fixes, (3) copy/tooltips.

Product commit baseline before lab (reminder):

```text
Branch: exp/planner-required-monthly-hero
Commit current Hero required-pair + −3 window vertical + legend toggles
Then leave product branch alone while lab iterates
```

---

## 10. Out of scope for this lab

- Backend / FastAPI / real `SanitizedPanel`  
- Planner Run / draft trajectory optimization  
- HE/EN i18n parity  
- Playwright e2e in product CI  
- Replacing Plotly in production Hero  

---

## 11. One-page runbook

```bash
# create
cd "C:\McDonalds\01_SOURCES(clean_code)"
npm create vite@latest planner-hero-scrub-lab -- --template react-ts
cd planner-hero-scrub-lab
npm install
# optional: npm install d3-scale && npm install -D @types/d3-scale

# run
npm run dev
# open http://localhost:5173

# iterate: A slider → B drag as-of + ghost → C what-if Y
```

---

## 12. Decision log (fill while experimenting)

| Date | Level | Observation | Keep / Drop |
|------|-------|-------------|-------------|
| | A | | |
| | B | | |
| | C | | |

---

*End of brief. Spec for standing up the lab and judging the look-and-feel of a dynamic required-pair scrubber without cluttering the product tree.*
