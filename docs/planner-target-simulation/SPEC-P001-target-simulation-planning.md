# SPEC-P001 — Target & Simulation Planning System (Survey MVP)

| Field | Value |
|-------|--------|
| **ID** | SPEC-P001 |
| **Track** | Planner Target & Simulation (SDD) |
| **Status** | Draft (decisions locked Q1–Q10) |
| **Branch** | `feat/planner-target-simulation` |
| **Contracts** | [domain-model.md](./contracts/domain-model.md), [api-v1.md](./contracts/api-v1.md) |
| **Inputs** | Business brief (Target & Simulation Planning); workshop Q1–Q10; current `src/planner/five_percent.py`, `POST /api/v1/plans`, Planner Hero FE, `excel_report` |

---

## 1. Goal

Deliver a Survey (`five_percent`, higher-is-better) planning system that:

1. Uses **cumulative** planning from the start of available data.
2. Allocates **differentiated boost / slopes** from distance to the **network mean**.
3. Separates **Baseline Plan** (frozen, versioned) / **Actual** / **Simulation** (live).
4. Caps unrealistic growth, flags unreachable stores, and proposes **limited store target adjustments**.
5. Exports a per-store months 1–12 Excel matrix with plan / actual / sim and baseline version context.

---

## 2. Locked decisions (Q1–Q10)

| ID | Topic | Decision |
|----|--------|----------|
| **D-01** | Scope MVP | **Survey Planner only.** TTS Planner is a later stage after Survey acceptance. |
| **D-02** | Cumulative grain | Accumulate from **start of available data**. MVP anchor: **2025-01**. Series name: **Cumulative Actual**. Not calendar-YTD-only and not the Hero Plan −3 window as default. |
| **D-03** | Boost / slope | Distance of store **start position** from **network mean**. Farther below mean → steeper slope / larger boost. Strong stores → milder slope from their start. Slope/weights must respect **store history** (achievable rates). |
| **D-04** | Strong stores / no drops | No artificial negatives or clawback because a store is ahead of target/mean. Default: mild upward trend. If at max or substantially ahead of schedule → **plateau / hold**. Never plan a decline for compensation. |
| **D-05** | Unreachable + cap | Unreachable when required rates exceed **100% over the reporting period** or exceed **historical capability**. Simulation capped at max realistic rate for that store. Auto-flag + **recommendation** to lower implied store target (e.g. 74→73) with network impact. |
| **D-06** | Target model | One **network target** (e.g. 75). Algorithm computes per-store implied curves. On unreachable → **limited target adjustment** at store level + rebalance network. |
| **D-07** | Baseline freeze | **DB plan versioning.** Blue baseline isolated from incoming actuals until explicit Recalculate / Save new version. |
| **D-08** | Simulation trigger | **Live:** recompute on app open and when new actuals arrive. Based on latest cumulative actuals → forecast to year end. Same cap/recommend rules as D-05. Simulation is **not** versioned. |
| **D-09** | Excel MVP | Per-store matrix months 1–12: Monthly Target, Cumulative Planned, Actual Performance, Cumulative Actual/Simulation, plus **baseline version context** for Plan vs Actual vs Forecast compare. Full version journal sheets are out of MVP (context of original/active baseline is enough). |
| **D-10** | Network mean weights | **Equal-weight arithmetic mean `1/n`.** No volume weighting in MVP. Boost distance = `store_score − network_mean`. |

---

## 3. Scope

### In scope (Survey MVP)

- Pure domain engine for cumulative paths, boost/slopes, simulation, unreachable hints.
- Plan-version persistence (SQLite app-store — see §6).
- HTTP contracts: save/list/get plan versions; run live simulation.
- FE: draw Plan / Actual / Simulation; series toggles; unreachable UX; Save Plan vs Export Excel.
- Excel matrix per D-09.
- Keep legacy `plan_five_percent` behind `solver: "legacy"` until cutover.

### Out of scope

- TTS Planner / lower-is-better port (follow-up stage).
- Volume-weighted network mean.
- Write-back to enterprise `TargetsByMetrics` / MSSQL OLTP.
- Full Angular StorePlanner / counterpart-pool parity.
- Kubernetes / multi-tenant plan stores.
- Replacing sanitization pipeline or panel derivation rules (panel remains cleansed `five_percent`).

### Supersedes (partial)

- [sanitized_panel_handoff.md](../contracts/sanitized_panel_handoff.md) non-goal “No DB Save” — **superseded for plan versions only**. Panel handoff and equal-weight chain lock remain.
- TASK-15 “CSV only (no DB Save)” — superseded for baseline versions; CSV/Excel export remain.

---

## 4. Domain rules (normative)

### 4.1 Entities

| Layer | Color (UI) | Mutability |
|-------|------------|------------|
| **Baseline Plan** | Blue | Frozen after Save; new Save → new version |
| **Actual** | Black | From cleansed panel facts (elapsed months) |
| **Simulation** | Grey (dashed/pulse) | Live recompute; not stored as a version |

### 4.2 Network mean

```text
network_mean = sum(store_score_i) / n    # equal weight 1/n
```

Grain for “current” mean used in boost: agreed as-of month scores (cleansed), unless a later phase defines cumulative-mean boost (not MVP).

### 4.3 Boost & slopes

- `gap_to_mean = network_mean - store_score` (positive ⇒ below mean ⇒ needs boost).
- Below mean: steeper positive slope; magnitude increases with `gap_to_mean`, capped by historical max rate.
- Above mean: mild positive slope or plateau (D-04); **lift ≥ 0** always for Survey higher-is-better monthly plan/sim steps.
- History: per-store max realistic monthly improve derived from available history from cumulative start (2025-01) through as-of.

Exact formula (coefficients, plateau threshold “substantially ahead”) is implemented in Phase 1 and recorded in REPORT-P001 / code docstrings; this SPEC locks **behaviour**, not a single closed-form equation.

### 4.4 Cumulative

- **Cumulative Actual** starts at MVP anchor **2025-01** (or first month present ≥ anchor).
- Continuity: no artificial jump at fact→sim handoff; sim continues from last cumulative actual.
- **Cumulative Planned** derived from frozen monthly targets of the active plan version.
- **Cumulative Actual/Simulation** = actual cumulatives for elapsed months, then sim for remaining months through planning year end.

### 4.5 Unreachable & limited adjustment

1. Build uncapped required path to implied store target under network target.
2. If required rate > history cap or period “>100%” rule → mark `unreachable`.
3. Cap displayed/sim path at realistic max.
4. Propose `suggested_implied_target` (e.g. one point lower) and show effect on projected network mean / feasibility.
5. Applying the suggestion is a user action (re-sim / optional new plan draft); auto-save of a new baseline is **not** implied.

### 4.6 Year / horizon

- Simulation forecasts through **end of the planning year** of the as-of context.
- Excel months **1–12** are calendar months of that planning year (empty/null actuals for future months).

---

## 5. UI requirements (normative for Phase 3)

1. Charts must expose toggles to show/hide Plan, Actual, Simulation (and cumulative companions as needed) on **network and store** heroes.
2. Blue baseline comes from **active plan version**, not session-only revert shadow.
3. Separate controls: **Save Plan version** vs **Export Excel** (do not conflate labels).
4. Unreachable stores surfaced in Inspect / At-risk with recommendation affordance.
5. Optional (P1, not MVP-blocking): split layout — top cumulative main trend, bottom monthly actuals.

---

## 6. Persistence decision

| Concern | Choice |
|---------|--------|
| Plan versions store | **SQLite app-store** file on host, Docker volume **`:rw`**, separate from sanitization snapshot (`:ro`) |
| Why | Matches Compose single-host ops; no MSSQL dependency for plans; snapshot stays immutable fact source |
| Simulation | **Not persisted** (recomputed) |
| FE sessionStorage | May cache UI draft / last `plan_version_id`; not source of truth for blue baseline |

Open ops detail (Phase 2/5): exact path env var (e.g. `PLAN_STORE_PATH`), backup with host refresh runbook.

---

## 7. Relationship to legacy allocator

| Solver | Role |
|--------|------|
| `cumulative_slope` (default after Phase 1+ cutover) | This SPEC |
| `legacy` | Current `plan_five_percent` / TASK-15 heuristic |

`POST /api/v1/plans` may keep legacy shape during transition; new simulation/version APIs follow [api-v1.md](./contracts/api-v1.md).

---

## 8. Implementation phases

| Phase | Deliverable | Acceptance (summary) |
|-------|-------------|----------------------|
| **0** | This SPEC + contracts | Decisions D-01…D-10 written; API/DTO drafts reviewed |
| **1** | Pure engine + unit tests | Non-decrease; plateau; weak>strong slope; unreachable+suggest; equal-weight mean |
| **2** | SQLite versions + API | Save→list→get immutable; sim live vs frozen blue |
| **3** | FE layers + toggles + UX | Three layers; toggles; Save≠Excel; unreachable chip |
| **4** | Excel matrix | D-09 columns; version context; tests |
| **5** | Harden | E2E; update panel handoff; runbook; legacy opt-in |

---

## 9. Acceptance criteria (SPEC itself)

- [x] D-01…D-10 recorded unambiguously.
- [x] In/out of scope and supersessions stated.
- [x] Domain layers Plan / Actual / Sim defined.
- [x] Persistence choice stated (SQLite app-store).
- [x] Domain + API contract drafts linked.
- [ ] Product owner ack (checkbox when reviewed).

---

## 10. Open items

| ID | Item | Status |
|----|------|--------|
| O-01 | History-cap statistic | **Locked in Phase 1:** default `max_mom` (max positive month-over-month delta), floor `min_history_cap=0.25`. Alternatives `p95_mom` / `best_window` implemented and selectable via `NetworkPlanParams`. |
| O-02 | Plateau “substantially ahead” threshold | **Locked in Phase 1:** `plateau_ahead_pp=2.0` — cumulative actual ≥ linear path to `network_target` + 2pp → slope 0. Also plateau at metric ceiling. |
| O-03 | Planning year when as-of spans into next calendar year | Open — Eng |
| O-04 | `PLAN_STORE_PATH` | **Locked in Phase 2:** env `PLAN_STORE_PATH` or default `data/plan_store.sqlite` (gitignored under `data/*.sqlite`). Docker volume `:rw` still to wire in Compose when packaging. |

Phase 1 code: `src/planner/cumulative_slope/` (`simulate`, `build_baseline_plan`). Tests: `tests/test_planner_cumulative_slope.py`.  
Phase 2: `src/planner/plan_store.py`, `backend/cumulative_plan_schemas.py`, routes `/api/v1/plan-versions`, `/api/v1/simulation`, `/api/v1/simulation/adjust`.
