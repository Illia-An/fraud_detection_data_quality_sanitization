# Contract: Domain model — Target & Simulation (Survey)

**Status:** Draft (Phase 0)  
**Spec:** [SPEC-P001](../SPEC-P001-target-simulation-planning.md)  
**Metric:** `five_percent` (higher-is-better), unit `%`, bounds `[0, 100]`  
**Chain:** equal-weight mean `1/n` (D-10)

This document is the type-level contract for Phase 1 (pure Python) and later HTTP/FE mapping. No I/O here.

---

## 1. Primitives

```ts
type MetricId = "five_percent"
type Direction = "higher_is_better"
type SolverId = "cumulative_slope" | "legacy"

interface YearMonth {
  year: number   // e.g. 2025
  month: number  // 1..12
}

interface MonthScore {
  year: number
  month: number
  score: number  // 0..100
}
```

---

## 2. Inputs

### 2.1 Panel facts (from sanitization handoff)

Reuse cleansed panel rows (`store_id`, `year`, `month`, `five_percent`).  
Cumulative spine starts at **2025-01** (D-02) or first available month ≥ anchor.

```ts
interface StoreMonthFact {
  store_id: number
  year: number
  month: number
  five_percent: number
}
```

### 2.2 Plan / simulation request params

```ts
interface NetworkPlanParams {
  network_target: number          // e.g. 75
  as_of: YearMonth                // last fact month used for “current”
  planning_year: number           // Excel M1..M12 year; sim runs through Dec of this year
  cumulative_start: YearMonth     // MVP default { year: 2025, month: 1 }
  solver: SolverId                // default "cumulative_slope"
  /** Phase-1 tunables; exact defaults locked in code + tests */
  history_cap_mode?: "max_mom" | "p95_mom" | "best_window"  // O-01
  plateau_ahead_pp?: number       // O-02: points ahead of schedule → plateau
}
```

---

## 3. Derived series (per store and network)

```ts
interface StoreCurves {
  store_id: number
  /** Frozen after Save — monthly target levels (Baseline Plan) */
  monthly_target: MonthScore[]
  cumulative_planned: MonthScore[]
  /** Elapsed months only */
  actual: MonthScore[]
  cumulative_actual: MonthScore[]
  /** Remaining months (and optionally stitch); live */
  simulation: MonthScore[]
  /** Actual cumulatives then sim cumulatives — continuous handoff */
  cumulative_actual_or_simulation: MonthScore[]
  implied_target: number
  gap_to_mean: number             // network_mean - store_as_of_score (D-03/D-10)
  slope: number                   // signed monthly rate used for sim/plan path
  unreachable: boolean
  suggested_implied_target: number | null
  capped: boolean                 // true if history/100% cap applied
}

interface NetworkSummary {
  network_target: number
  network_mean_as_of: number      // 1/n at as_of
  projected_network_mean_eoy: number
  feasible: boolean               // projected mean meets network_target under caps
  store_count: number
}
```

### Continuity rule

At the last actual month `T`:

```text
cumulative_actual_or_simulation[T] == cumulative_actual[T]
cumulative_actual_or_simulation[T+k] continues from simulation steps
```

No artificial drop at the handoff (D-04).

### Monotone rule (Survey)

For Baseline Plan monthly targets and Simulation monthly scores on a store:

```text
score[m] >= score[m-1]     # within floating epsilon
```

Plateau allowed (`==`). Decline forbidden.

---

## 4. Plan version (persisted)

```ts
interface PlanVersionMeta {
  id: string                      // opaque id (uuid or monotonic)
  created_at: string              // ISO-8601 UTC
  label?: string
  metric_id: MetricId
  direction: Direction
  solver: SolverId
  network_target: number
  as_of: YearMonth
  planning_year: number
  cumulative_start: YearMonth
  network_mean_at_save: number
  params: NetworkPlanParams
}

interface PlanVersionStoreRow {
  store_id: number
  monthly_target: MonthScore[]    // planning_year M1..M12 (or horizon subset; Excel pads 1..12)
  implied_target: number
  cumulative_planned: MonthScore[]
}

interface PlanVersion {
  meta: PlanVersionMeta
  stores: PlanVersionStoreRow[]
  network_monthly_target: MonthScore[]
  network_cumulative_planned: MonthScore[]
}
```

Immutability: after insert, rows are read-only. “Recalculate / Save new plan” → **new** `PlanVersion`.

---

## 5. Live simulation result (not persisted)

```ts
interface UnreachableHint {
  store_id: number
  implied_target: number
  suggested_implied_target: number
  reason: "above_period_100pct" | "above_history_cap"
  network_impact_pp: number       // change in projected network mean if suggestion applied
}

interface SimulationResult {
  as_of: YearMonth
  planning_year: number
  active_plan_version_id: string | null  // blue overlay source; null = no saved baseline
  network: NetworkSummary
  stores: StoreCurves[]
  unreachable: UnreachableHint[]
}
```

When `active_plan_version_id` is set, `stores[*].monthly_target` / `cumulative_planned` come from that version (frozen). Simulation fields always recomputed from latest facts.

---

## 6. Limited target adjustment

```ts
interface ApplyStoreAdjustment {
  store_id: number
  new_implied_target: number      // typically suggested_implied_target
}

/** Re-run simulation with overridden implied targets; does not Save a PlanVersion */
interface SimulationWithAdjustments {
  base: SimulationResult
  adjustments: ApplyStoreAdjustment[]
}
```

Persisting adjustments into a new baseline requires an explicit Save (D-07).

---

## 7. Excel document mapping (Phase 4)

Per store, planning year months 1–12:

| Metric key | Source |
|------------|--------|
| `monthly_target` | Active/selected `PlanVersion` |
| `cumulative_planned` | From version |
| `actual_performance` | Facts; null/empty for future months |
| `cumulative_actual_or_simulation` | From `SimulationResult` |
| Version context | `PlanVersionMeta` (id, created_at, network_target, params) |

Builder must **not** recompute planner math; it copies scores from the domain document (same rule as current `excel_report`).

---

## 8. Legacy bridge

`solver: "legacy"` maps to today’s `FivePercentPlanResult` (`projections`, `feasible`, …).  
Legacy output does **not** satisfy cumulative/boost/unreachable contracts; FE must not treat it as Baseline/Sim layers of this SPEC.
