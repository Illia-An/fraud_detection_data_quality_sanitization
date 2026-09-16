# Specification: Survey KPI What-If Sanitization Engine
**Version:** 1.0.0-prototype  
**Status:** Approved  
**Domain:** Q10012 Top-Box Network Impact Engine

---

## 1. Context & Boundaries
- **Objective:** Compute survey sanitization deltas (Actual → Tier1 → Tier2 → Tier3 → Tier4) on Q10012 five-star percentage.
- **In-Scope:** 
  - Tier 1: BlackList filtering (Hebrew: 'לא').
  - Tier 2: Frequency rule (>= N per entity×store×day; default on).
  - Tier 3: Optional always top-box (100% fives with enough history).
  - Tier 4: Store×Month anomaly flagging (volume >= 30, z > 2.0 OR top_box >= 90%; toggleable).
- **Out-of-Scope (Non-Goals):**
  - No ML / research Tier 5+ models in production API pipeline.
  - No raw survey responses emitted to UI if source=db.
  - No writing/mutating SQL Server DB (strictly read-only).

---

## 2. Shared Data Contracts (Pydantic v2)

```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

class PipelineConfig(BaseModel):
    tier1_blacklist_enabled: bool = True
    tier2_freq_enabled: bool = True
    tier2_freq_threshold: int = Field(default=3, ge=1)
    tier3_always_five_enabled: bool = False
    tier3_always_five_min_n: int = 10
    tier4_enabled: bool = True
    tier4_min_volume: int = Field(default=30, ge=1)
    tier4_z_threshold: float = Field(default=2.0, ge=0.0)
    tier4_pct_threshold: float = Field(default=90.0, ge=0.0, le=100.0)

class StepMetric(BaseModel):
    step_name: Literal["actual", "tier1", "tier2", "tier3", "tier4"]
    rows_in: int
    rows_out: int
    rows_dropped: int
    top_box_pct: float

class SanitizationResponse(BaseModel):
    baseline_top_box_pct: float
    final_top_box_pct: float
    network_delta_pp: float
    steps: list[StepMetric]
    high_store_months: list[dict]
    store_impact_series: list[dict]
    echo_config: PipelineConfig
    meta: dict
```

---
### 3. Architecture & Invariants
- **Invariant 1 (PII Hashing): Any incoming UserContact or PhoneFromLog MUST be hashed using SHA-256 (truncated to 32 chars) prior to any processing or in-memory grouping.
- **Invariant 2 (Entity Identity Fallback): Identity key resolution must be deterministic:
contact -> phone -> ext_user_id (if != 0) -> None.
- **Invariant 3 (Top-Box KPI Definition): Target question is strictly Question_ID = 10012. Top-box value is strictly Answer_Value = 5.
- **Invariant 4 (SQL Boundary): Raw SQL queries MUST NOT execute SELECT *. Only audit-approved must-columns are allowed.
- **Invariant 5 (Deterministic Diff): network_delta_pp = final_top_box_pct - baseline_top_box_pct.

---

### 4. Acceptance Criteria
- [x] Response echoes back the complete effective PipelineConfig for reproducibility.
- [x] No sys.path.insert workarounds anywhere in src/.
- [x] 100% of existing tests pass with zero schema regression.

---

## Section 5: Data Access & Pushdown Strategy
### 5.1. Baseline Architectural Problem
In the baseline implementation, requests with source="db" performed a full SELECT of hundreds of thousands of rows from a SQL Server VIEW into a pandas.DataFrame. This resulted in:

- High RAM consumption, creating an OOM risk under concurrent requests.
- Unnecessary network I/O between SQL Server and FastAPI.
- Increased processing time caused by type parsing and aggregate calculations in Python.


### 5.2. Query Separation Pattern (Query A / Query B)
Instead of performing a monolithic data extraction, the pipeline is split into two independent stages:

1. **Query A (SQL Pushdown — Baseline Metrics):**

- **Purpose:**  Calculate the aggregated metrics for the actual step directly in the database.
- **Scope:** No raw rows should be loaded into application memory.
- **Grouping:** store_id, month_year.
- **Metrics:**
total_responses = COUNT(*)
top_box_count = COUNT(CASE WHEN Question_ID = 10012 AND Answer_Value = 5 THEN 1 END)
top_box_pct = (top_box_count * 100.0) / NULLIF(total_responses, 0)
- **Invariants:** Strictly comply with Invariant 3 and Invariant 4. No SELECT * is permitted.

2. **Query B (Candidate Selection — Suspicious Feedback) — v1:**

- **Purpose:** Retrieve only Tier 1 **blacklist** candidate rows (non-customer `BlackList`), not the full period scan.
- **v1 scope (performance):** Single filtered `SELECT` of essential columns where
  `BlackList IS NULL OR BlackList <> N'לא'` (when blacklist is enabled). **No** SQL-side frequency `HAVING` / entity CTE in v1 — those predicates caused multi-minute scans on the production VIEW.
- **Out of scope for Query B v1 (phase 2):** SQL pushdown for high-frequency entity×store×day and always-5 entity groups on the **production VIEW** (too slow).
- **Phase 2 (snapshot / fast physical tables):** When `SANITIZATION_SOURCE=snapshot`, Query B selects the union of:
  - blacklist candidates (if enabled),
  - when `tier2_freq_enabled`: all rows in entity×store×day groups with `COUNT(*) >= tier2_freq_threshold`,
  - when `tier3_always_five_enabled`: all rows for entities with `n >= tier3_always_five_min_n` and 100% top-box.
  Pushdown then applies **tiers 1–3** on those candidates (`query_b_mode=tier1_full`, legacy name).
- **Tier 4:** Applied in application memory on Query A aggregates after tier 1–3 drops (no full raw store-month scan).
- **Columns (Invariant 4):** essential fields only — e.g. `UserContact`, `PhoneFromLog`, `ext_user_id`, `Question_ID`, `Answer_Value`, `BlackList`, `PrintStore`, `AnswerTime`, `Year`, `Month` (+ `ParticipateNumber`). No `SELECT *`.
- **Invariant 1:** PII hashing before any in-memory grouping on Query B rows.

### 5.3. Profiling Metadata (Meta Block)
The SanitizationResponse.meta field must expose telemetry metrics for pipeline profiling:

- `execution_time_ms` : Total wall-clock execution time of the pipeline.
- `peak_memory_mb` : Peak RAM usage during execution, measured using tracemalloc.
- `db_query_a_time_ms`: Execution and aggregation time for Query A.
- `db_query_b_time_ms` : Execution time for Query B.
- `rows_scanned` : Total number of rows processed in Python. This value should decrease significantly compared with the baseline.

### 5.4. Daily Snapshot (Dev / Interim Fast Path)
While DBA prepares physical SQL Server tables (`Q10012_Sanitization_Answers` / `_StoreMonth`), the app MAY read a **local SQLite daily snapshot** instead of the production VIEW.

**Purpose:** Keep `source=db` `/process` under ~1 minute (target: seconds) without changing Tier1/Tier2 pipeline logic.

**Env switch (backward compatible):**
- `SANITIZATION_SOURCE=view` (default) — Query A/B hit `dbo.TargetsByMetrics_RateGetAnswers` via `DATABASE_URL`.
- `SANITIZATION_SOURCE=snapshot` — Query A/B hit local SQLite via `SNAPSHOT_URL` (default `sqlite:///data/q10012_snapshot.sqlite`).

**Refresh job:** `scripts/refresh_q10012_snapshot.py` full-reloads from the VIEW once per day (or on demand):
- Filter: `Question_ID = 10012`, `Answer_Value IS NOT NULL`, `AnswerTime >= 2026-01-01`.
- Tables: `answers` (fact rows + `LoadedAt`), `store_month` (pre-aggregates), `snapshot_meta` (freshness).
- PII columns may be stored **locally only**; never commit `*.sqlite` or `*_internal_pii*` exports.

**Query mapping on snapshot:**
- Query A → `store_month` (no raw-row scan).
- Query B **phase 2** → `answers` with blacklist ∪ (optional freq≥N) ∪ optional always-5 (`query_b_mode=tier1_full`).
- VIEW path remains Query B **v1** blacklist-only.

**Migration path:** When DBA tables land, flip connection / table names only; pipeline and pushdown contract stay the same.