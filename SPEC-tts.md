# Specification: TTS (Time To Serve) Sanitization Track

**Version:** 0.1.0-draft  
**Status:** Draft (Stage 0 — contract lock; implementation in later stages)  
**Domain:** Kitchen monitor dwell time (McKiti bump) — parallel to Q10012 five-percent track  
**Roadmap:** `docs/plan-tts-into-product-staged.md`  
**Research:** `docs/research/tts_research_result/`

This SPEC does **not** replace `SPEC.md` (Q10012). TTS is a second metric track on the same product trunk.

---

## 1. Context & Boundaries

### Objective

Compute TTS sanitization deltas (**Actual → ge30**) on kitchen monitor dwell time, expose network and store×month impact, then (later stages) hand a cleansed panel to a planner-like surface.

### In scope (product track, staged)

- Read-only access to `MC.dbo.TargetsByMetrics_McKitiBump`
- TTS definition: monitor dwell only (see Invariant T1)
- Sanitization rule v1: keep observations with **TTS ≥ `tts_min_sec`** (default **30**)
- Optional order collapse via `order_agg` (contract present; v1 runtime default `none`)
- Separate API path from Q10012 `/process` (planned: `POST /api/v1/process-tts`)
- Gradual UI / panel / planner-like delivery on trunk (see roadmap)

### Out of scope / non-goals

- Payment → screen latency (not available in the view)
- Mutating SQL Server (read-only `SELECT`)
- Replacing or changing Q10012 tiers / Planner / Pressure / onboarding
- Assuming 5% Tier1–4 rules apply to TTS
- Long-lived “full TTS integration” branch; UX compose can follow after sanitize+panel exist
- ML models in the TTS pipeline
- Official report reconciliation (backlog)
- TTS sqlite snapshot fast-path (backlog; mirror Q10012 pattern later)

---

## 2. Shared Data Contracts (draft — Pydantic v2)

Implementation lands in Stages 2–3. This section is the **contract lock** for those stages.

```python
from datetime import date
from typing import Any, Literal
from pydantic import BaseModel, Field

OrderAgg = Literal["none", "avg", "max"]
TtsStepName = Literal["actual", "ge30"]


class TtsPipelineConfig(BaseModel):
    """Effective TTS sanitization settings (echoed on every response)."""

    tts_min_sec: int = Field(default=30, ge=0)
    """Keep rows/orders with TTS_sec >= this value. Business default: 30."""

    order_agg: OrderAgg = "none"
    """
    none — KPI on bump rows (v1 default).
    avg  — collapse bumps to order via mean TTS, then aggregate.
    max  — collapse bumps to order via max TTS (stricter service picture).
    Order aggregation does NOT replace the >= tts_min_sec filter.
    """


class TtsStepMetric(BaseModel):
    step_name: TtsStepName
    rows_in: int
    rows_out: int
    rows_dropped: int
    mean_tts_sec: float
    median_tts_sec: float | None = None


class TtsStoreImpactPoint(BaseModel):
    """Store × calendar month cell (draft shape for series / panel)."""

    store_id: int
    year: int
    month: int  # 1..12
    actual_mean_tts_sec: float | None = None
    after_ge30_mean_tts_sec: float | None = None
    volume_before: int | None = None
    volume_after: int | None = None


class TtsSanitizationResponse(BaseModel):
    baseline_mean_tts_sec: float
    final_mean_tts_sec: float
    network_delta_sec: float
    """Deterministic: final_mean_tts_sec - baseline_mean_tts_sec."""

    steps: list[TtsStepMetric]
    store_impact_series: list[TtsStoreImpactPoint] | list[dict[str, Any]]
    echo_config: TtsPipelineConfig
    meta: dict[str, Any]


# API request (Stage 3) — sketch:
# class TtsProcessRequest(BaseModel):
#     source: Literal["db"] = "db"
#     from_date: date | None = None
#     to_date: date | None = None
#     config: TtsPipelineConfig | None = None
#     store_ids: list[int] | None = None
```

Detailed handoff notes: `docs/contracts/tts_process_handoff.md`.

### Panel draft (Stage 5 — not implemented in Stage 0)

| Field | Meaning |
|-------|---------|
| `store_id` | `StoreIndex` |
| `year` / `month` | Calendar from `SaleDate` |
| `tts_sec` | Cleansed mean (after `ge30`; after `order_agg` if not `none`) |
| `volume` | Row or order count after clean (grain follows `order_agg`) |

---

## 3. Architecture & Invariants

- **Invariant T1 (TTS clock):**  
  `TTS_sec = DATEDIFF(SECOND, UpDatetime, BumpDateTime)` when `BumpDateTime` is not null.  
  This is **monitor dwell only** (screen up → bump). Pre-KVS / payment clocks are out of scope.

- **Invariant T2 (Sanitization layer):**  
  Observations failing `TTS_sec >= tts_min_sec` are dropped at step `ge30`.  
  Default `tts_min_sec = 30`. Negatives and sub-threshold shorts are excluded after this step.

- **Invariant T3 (Order collapse is separate):**  
  `order_agg` collapses bump rows to an order key  
  (`StoreIndex` + calendar day of `SaleDate` + `WeborderID`) using AVG or MAX.  
  It does **not** replace T2. v1 product default is `order_agg = "none"` (bump-row KPI).

- **Invariant T4 (SQL boundary):**  
  Raw SQL MUST NOT use `SELECT *`. Only audit-approved columns from the McKitiBump schema doc.

- **Invariant T5 (Deterministic network delta):**  
  `network_delta_sec = final_mean_tts_sec - baseline_mean_tts_sec`.

- **Invariant T6 (Isolation from Q10012):**  
  TTS must not change `PipelineConfig`, `/api/v1/process`, or five-percent Planner contracts. Prefer a dedicated endpoint and schemas.

- **Invariant T7 (Read-only DB):**  
  No writes to source SQL Server.

### Source system

| Item | Value |
|------|-------|
| Database | `MC` |
| View | `dbo.TargetsByMetrics_McKitiBump` |
| Base table (reference) | `dbo.AABO_McKitiBumpTimes` |
| Schema doc | `docs/research/tts_research_result/schema_TargetsByMetrics_McKitiBump.md` |

### Audit-approved columns (minimum for TTS)

`StoreIndex`, `SaleDate`, `WeborderID`, `KVSGroup`, `MeitNumber`, `SortOrder`, `UpDatetime`, `BumpDateTime`  
(`Grill` is not a duration — do not use as TTS.)

---

## 4. Acceptance Criteria (Stage 0)

- [x] TTS product definition locked in this SPEC (clock, ≥30, layers, isolation).
- [x] Draft response / config contract documented (Section 2 + `docs/contracts/tts_process_handoff.md`).
- [x] Research pack referenced; open questions and backlog listed.
- [x] Q10012 `SPEC.md` unchanged in behavior; no engine/API/UI code required in Stage 0.
- [ ] Stages 1–6 implement against this contract (tracked in roadmap).

---

## 5. Data access notes (for Stage 1+)

Follow the same pushdown discipline as Q10012 where practical:

1. **Query A-like:** store×month (or agreed grain) aggregates for baseline mean TTS without pulling unnecessary columns.
2. **Row path:** only columns listed in §3 when computing `ge30` / optional order collapse in app memory (or SQL equivalents).
3. **Meta (target):** `execution_time_ms`, `peak_memory_mb`, query timings, `rows_scanned`, `period_start` / `period_end`.

Snapshot fast-path for TTS is **backlog**, not v1 blocker.

---

## 6. Open questions (non-blocking)

1. Confirm with ops/customer: Up→Bump is the official TTS clock.
2. ~~When enabling `order_agg`: filter bumps ≥30 then MAX/AVG vs filter on order metric~~ — **Stage 2 lock:** ge30 on bumps **then** collapse (`meta.order_agg_applied_after_ge30`).
3. Strict `< 30` vs `<= 30` wording — implementation uses `TTS_sec >= tts_min_sec` (default 30).
4. Which `KVSGroup` values (21 / 31) enter the official KPI?
5. Optional long-tail cap (e.g. > 1h) — research: low mean impact after ≥30.
6. Why view ⊂ base table — reuse business filter when `VIEW DEFINITION` available?

---

## 7. Backlog (explicit)

- Configurable `tts_min_sec` in UI
- UI toggle for `order_agg` (`avg` / `max`)
- KVSGroup inclusion filter
- Long-tail cap
- TTS sqlite snapshot / Docker data path
- Reconcile vs official TTS report
- Onboarding / analytics for TTS
- UX compose (`exp/tts-ux-compose`) after sanitize+panel exist
- Planner-like Pressure analogue for seconds (only after explicit product rules)

---

## 8. Stage delivery (summary)

| Stage | Branch (example) | Outcome |
|-------|------------------|---------|
| 0 | `exp/tts-spec-contract` | This SPEC + contract docs |
| 1 | `exp/tts-db-read` | Read-only queries |
| 2 | `exp/tts-engine-ge30` | Pure `tts_guard` (or equiv.) |
| 3 | `exp/tts-api-process` | `/process-tts` |
| 4 | `exp/tts-ui-sanitize` | What-if UI |
| 5 | `exp/tts-panel-handoff` | Cleansed monthly panel |
| 6 | `exp/tts-planner-*` | Planner-like epic |
