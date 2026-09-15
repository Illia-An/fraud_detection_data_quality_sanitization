# Prototype Tasks Queue

- [x] **TASK-01 [Contract Engineer]**: Refactor `src/schemas/` to implement `PipelineConfig` with `echo_config` and clean domain naming (replace legacy fraud naming with sanitization).
  - *Contract:* `SPEC.md#2`
  - *Verify:* `pytest tests/test_contracts.py` (or existing schema tests).

- [x] **TASK-02 [Engine Optimizer]**: Remove `sys.path` hacks across `src/` and ensure clean absolute module imports using standard package resolution (`uv`/pyproject).
  - *Contract:* `SPEC.md#4`
  - *Verify:* Run CLI/FastAPI app import without path mutations.

- [x] **TASK-03 [Drift Verifier]**: Run full test suite, verify end-to-end `/process` output matches `SanitizationResponse` without schema breaks.

- [x] **TASK-04 [Engine Optimizer]**: Refactor Tier 1 and Tier 2 processing pipelines in `src/fraud_guard/` to strictly satisfy Invariants 1, 2, 3, and 5 from `SPEC.md#3`. Ensure PII hashing occurs before any grouping.
  - *Contract:* `SPEC.md#3`
  - *Verify:* `pytest tests/test_tier1.py tests/test_tier2.py`

- [x] **TASK-05 [Contract Engineer]**: Wire the `/api/v1/process` FastAPI endpoint to return the exact `SanitizationResponse` payload with `echo_config`.
  - *Contract:* `SPEC.md#2`
  - *Verify:* Run integration test against `/api/v1/process`.

## [TASK-07] SQL Pushdown for Actual Baseline
- **Role:** DB/Data Engineer
- **Objective:** Eliminate the full scan of raw rows into RAM for the actual step.
- **Files to modify:**
- `src/db/queries.py` (or the applicable data-access module)
- `src/services/sanitization_service.py`
- **Requirements**
1. Implement a function/query named `get_actual_baseline_aggregates(period_start, period_end, store_ids=None)`.
2. The SQL query must return strictly aggregated data grouped by `store_id` and `period`, with the following fields:
`total_count`
`top_box_count`
3. The `actual` step must be built directly from the Query A results, without creating intermediate DataFrames containing raw rows.
4. Comply with Invariant 4 by selecting only the columns required by the aggregation.
- **Definition of Done (Acceptance Criteria)**
When `source="db"`, process memory must not increase proportionally to the number of raw rows in the requested period.
The `total_responses` and `top_box_pct` metrics produced by the `actual` step must match the baseline implementation to an accuracy of 4 decimal places.


## [TASK-08] Latency & RAM Profiling in the Meta Block
- **Role:** Engine Optimizer
- **Objective:** Provide transparent resource monitoring to validate the impact of TASK-07.
- **Files to modify:**
-`src/schemas/response.py` (the ResponseMeta model)
- `src/services/profiler.py` (profiling context manager)
- `src/api/v1/endpoints/process.py`
- ** Requirements **
1. Implement a context manager using `time.perf_counter` and `tracemallo`c to measure execution time and peak memory usage.
2. Extend the Pydantic ResponseMeta schema with:
-`execution_time_ms`
- `peak_memory_mb`
- `rows_scanned`
3. Propagate the collected profiling metrics into the final `SanitizationResponse.meta`.
- **Definition of Done (Acceptance Criteria):**
- A call to `/api/v1/process` must return valid numeric values in the response body:
`execution_time_ms` (> 0)
`peak_memory_mb`  (>= 0)
- Add a test in `tests/test_profiler.py` covering the profiling context manager.

## [TASK-09] SQL Pushdown for Query B (Candidate Selection)
- **Role:** DB/Data Engineer
- **Status:** Done (v1 — blacklist-only; freq/always-5 SQL = phase 2)
- **Objective:** Reduce Python-side RAM and I/O for `source="db"` by loading only Tier 1 blacklist candidate rows instead of the full period scan (SPEC Section 5.2 Query B v1).
- **Depends on:** TASK-07 (Query A actual baseline), TASK-08 (profiling meta).
- **v1 decision:** Drop SQL CTE/HAVING/EXISTS for frequency — too slow on production VIEW (>7 min). Query B is a single `BlackList` filter; Tier2 stays on Query A aggregates.
- **Files to modify (map to current layout):**
  - `backend/queries.py` (or applicable data-access module)
  - `backend/db_sample.py` / `backend/service.py`
  - `backend/main.py` (`source=db` orchestration)
  - `tests/test_queries.py` (or `tests/test_query_b.py`)
- **Requirements**
  1. Implement a function named `get_tier_candidate_rows(period_start, period_end, config, store_ids=None)` (Query B).
  2. Query B MUST NOT use `SELECT *` (Invariant 4). Select only essential columns needed by Tier 1 / Tier 2, e.g.:
     `UserContact`, `PhoneFromLog`, `ext_user_id`, `Question_ID`, `Answer_Value`, `BlackList`, `PrintStore`, `AnswerTime`, `Year`, `Month` (plus any other audit-approved must-columns already used by the pipeline).
  3. Push candidate predicates to SQL whenever practical (HAVING / semi-joins), including at least:
     - BlackList staff filter candidates (`BlackList` = Hebrew `לא` when Tier 1 blacklist is enabled)
     - High-frequency entity×store×day groups (`COUNT(*) >= tier1_freq_threshold`)
     - Optional always-5 entity candidates when `tier1_always_five_enabled` is true
     - Tier 2 outlier store×month cells (volume / z / top-box thresholds from `PipelineConfig`), or an equivalent SQL-side prefilter consistent with Tier 2 rules
  4. Wire `source="db"` so:
     - Query A still builds the `actual` step / `baseline_top_box_pct`
     - Query B supplies only candidate rows for Tier 1 / Tier 2
     - Final KPI / `network_delta_pp` remain consistent with the full-scan baseline to **4 decimal places** (document the reconciliation method: e.g. apply drops on candidates and recompute final rates against Query A totals, or an approved equivalent)
  5. Populate `meta.db_query_b_time_ms` and ensure `meta.rows_scanned` reflects Query B rows only (not the full period cardinality).
- **Definition of Done (Acceptance Criteria)**
  - For the same period, `rows_scanned` under Query B is **materially lower** than the previous full-period load (target: clearly below full Q10012 period row count; record before/after via TASK-08 meta).
  - `peak_memory_mb` for `source="db"` does not scale linearly with the full raw period size the way the pre-pushdown path did.
  - `baseline_top_box_pct` (Query A) and post-sanitization `final_top_box_pct` / `network_delta_pp` match the full-scan reference within **4 decimal places** on a fixed fixture or live period sample.
  - Unit/integration tests cover: SQL shape (no `SELECT *`), candidate filters, and KPI parity.
  - PII hashing (Invariant 1) still occurs before any in-memory grouping on Query B rows.



## [TASK-10] Daily Q10012 SQLite Snapshot (S0–S5)
- **Role:** DB/Data Engineer + Engine Optimizer
- **Status:** Done (S0–S5)
- **Contract:** `SPEC.md#5.4`
- **Objective:** Interim fast path while DBA builds physical tables — daily copy VIEW → local SQLite; app `source=db` reads snapshot.
- **Stages / DoD**
  - **S0** Document snapshot source in SPEC/TASKS — done.
  - **S1** SQLite schema (`answers`, `store_month`, `snapshot_meta`) + gitignore `data/*.sqlite` — done.
  - **S2** `scripts/refresh_q10012_snapshot.py` — full reload from VIEW + aggregates + log — done.
  - **S3** Wire Query A/B via `SANITIZATION_SOURCE` / `SNAPSHOT_URL` — done.
  - **S4** Unit/API smoke on mini snapshot (`tests/test_snapshot.py`) — done.
  - **S5** Query B phase 2 on snapshot: freq + always-5 candidate SQL + full Tier1 pushdown (`query_b_mode=tier1_full`); VIEW stays v1 blacklist-only — done (`tests/test_query_b_phase2.py`).
- **Do not commit:** `*_internal_pii*`, `data/*.sqlite`.

## [TASK-06] Frontend Contract Alignment & Telemetry UI
- **Role:** Frontend Engineer (with participation from Contract Engineer)
- **Status:** Done
- ** Goal:** Synchronize the client layer (React 19 / Vite / MUI / TanStack Query) with the production API contract and eliminate legacy terminology drift.
- **Input artifacts:** `SPEC.md` (Section 4: Schema & Section 5: Meta), current types in `frontend/src/`.
- **Files to modify:**
-`frontend/src/types/sanitization.ts` (or the equivalent DTO file)
- `frontend/src/api/` (request client for `/api/v1/process`)
- `frontend/src/components/KPICards/` and chart components
- **Requirements:**
1. Fully replace the outdated `fraud_*` fields with the product fields `sanitized_*` / `excluded_*`.
2. Synchronize the Zod response parsing schemas: add mandatory validation for `echo_config` and the `meta` block.
3. Update the step mapping: strictly deterministic chain `actual` -> `tier1` -> `tier2`.
4. Display the `meta` telemetry block (`execution_time_ms`, `peak_memory_mb`, `rows_scanned`) in the UI.
- **DoD (Definition of Done):**
- TypeScript compiles without errors (`tsc --noEmit` exits with status 0).
- Zod schemas successfully parse a real response from the backend.
Searching the frontend codebase (`grep -r "fraud" frontend/src/`) returns 0 matches.
