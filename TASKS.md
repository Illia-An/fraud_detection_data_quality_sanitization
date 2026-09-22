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
- **Status:** Done
- **Objective:** Eliminate the full scan of raw rows into RAM for the actual step.
- **Files (current layout):** `backend/queries.py`, `backend/service.py`
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
- **Status:** Done
- **Objective:** Provide transparent resource monitoring to validate the impact of TASK-07.
- **Files (current layout):** `backend/profiler.py`, `backend/service.py` / process path, response `meta`
- **Requirements**
1. Implement a context manager using `time.perf_counter` and `tracemalloc` to measure execution time and peak memory usage.
2. Extend response `meta` with:
- `execution_time_ms`
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
- **Status:** Done (v1 — blacklist-only on VIEW; freq/always-5 SQL = snapshot phase 2)
- **Objective:** Reduce Python-side RAM and I/O for `source="db"` by loading only candidate rows instead of the full period scan (SPEC Section 5.2 Query B).
- **Depends on:** TASK-07 (Query A actual baseline), TASK-08 (profiling meta).
- **v1 decision:** Drop SQL CTE/HAVING/EXISTS for frequency on production VIEW (>7 min). Query B is a single `BlackList` filter; Tier4 stays on Query A aggregates after row-tier drops.
- **Files (current layout):**
  - `backend/queries.py`
  - `backend/db_sample.py` / `backend/service.py`
  - `backend/main.py` (`source=db` orchestration)
  - `tests/test_queries.py`, `tests/test_query_b.py`
- **Requirements**
  1. Implement a function named `get_tier_candidate_rows(period_start, period_end, config, store_ids=None)` (Query B).
  2. Query B MUST NOT use `SELECT *` (Invariant 4). Select only essential columns needed by tiers 1–3, e.g.:
     `UserContact`, `PhoneFromLog`, `ext_user_id`, `Question_ID`, `Answer_Value`, `BlackList`, `PrintStore`, `AnswerTime`, `Year`, `Month` (plus any other audit-approved must-columns already used by the pipeline).
  3. Push candidate predicates to SQL whenever practical (HAVING / semi-joins), including at least:
     - BlackList staff filter candidates (`BlackList` ≠ Hebrew `לא` when Tier 1 blacklist is enabled)
     - High-frequency entity×store×day groups (`COUNT(*) >= tier2_freq_threshold`) — **snapshot phase 2**
     - Optional always-5 entity candidates when `tier3_always_five_enabled` is true — **snapshot phase 2**
     - Tier 4 outlier store×month cells applied in-app on Query A aggregates after tiers 1–3 drops
  4. Wire `source="db"` so:
     - Query A still builds the `actual` step / `baseline_top_box_pct`
     - Query B supplies only candidate rows for tiers 1–3 (mode depends on VIEW vs snapshot)
     - Final KPI / `network_delta_pp` remain consistent with the full-scan baseline to **4 decimal places**
  5. Populate `meta.db_query_b_time_ms` and ensure `meta.rows_scanned` reflects Query B rows only (not the full period cardinality).
- **Definition of Done (Acceptance Criteria)**
  - For the same period, `rows_scanned` under Query B is **materially lower** than the previous full-period load.
  - `peak_memory_mb` for `source="db"` does not scale linearly with the full raw period size the way the pre-pushdown path did.
  - `baseline_top_box_pct` (Query A) and post-sanitization `final_top_box_pct` / `network_delta_pp` match the full-scan reference within **4 decimal places**.
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
  - **S5** Query B phase 2 on snapshot: freq + always-5 candidate SQL + full Tier1–3 pushdown (`query_b_mode=tier1_full`); VIEW stays v1 blacklist-only — done (`tests/test_query_b_phase2.py`).
- **Do not commit:** `*_internal_pii*`, `data/*.sqlite`.

## [TASK-06] Frontend Contract Alignment & Telemetry UI
- **Role:** Frontend Engineer (with participation from Contract Engineer)
- **Status:** Done (extended by TASK-11 for four-tier UI)
- **Goal:** Synchronize the client layer (React 19 / Vite / MUI / TanStack Query in `web/`) with the production API contract and eliminate legacy terminology drift.
- **Input artifacts:** `SPEC.md` (Section 2 Schema & Section 5 Meta), types in `web/src/schemas/`.
- **Files (current layout):**
  - `web/src/schemas/api.ts`, `web/src/schemas/configForm.ts`
  - `web/src/components/KpiCards.tsx`, chart / pipeline tables
  - `web/src/components/TelemetryMetaCard.tsx` (or equivalent)
- **Requirements:**
1. Fully replace outdated `fraud_*` fields with product sanitization naming.
2. Synchronize Zod response parsing: mandatory `echo_config` and `meta` block.
3. Step mapping: deterministic chain `actual` → `tier1` → `tier2` → `tier3` → `tier4` (see TASK-11).
4. Display the `meta` telemetry block (`execution_time_ms`, `peak_memory_mb`, `rows_scanned`) in the UI.
- **DoD:**
  - TypeScript compiles without errors (`tsc --noEmit` exits with status 0).
  - Zod schemas successfully parse a real response from the backend.
  - Searching the web codebase for legacy fraud DTO field names returns 0 product-path matches.

## [TASK-11] Four-tier sequential pipeline + UI thresholds
- **Role:** Contract Engineer + Engine Optimizer + Frontend Engineer + Drift Verifier
- **Status:** Done
- **Contract:** `SPEC.md#1`, `SPEC.md#2`
- **Objective:** Split the former bundled Tier1+Tier2 model into **four independent sequential tiers** with cumulative KPI impact; expose all toggles/thresholds in the React UI.
- **Pipeline model**
  | Step | Rule |
  |------|------|
  | `actual` | Baseline (Query A / inline) |
  | `tier1` | BlackList (keep Hebrew `לא`) |
  | `tier2` | Frequency entity×store×day (`tier2_freq_threshold`, **ge=2**) |
  | `tier3` | Always top-box (optional; `tier3_always_five_min_n`) |
  | `tier4` | Store×month anomaly (former “Tier 2” store-month rule) |
- **Delivered**
  1. **Contract:** `PipelineConfig` / `StepMetric.step_name` / legacy key migration (`tier1_freq_*` → `tier2_freq_*`, etc.) in `src/schemas/pipeline.py`, `SPEC.md`, Zod `web/src/schemas/api.ts`.
  2. **Engine:** sequential `apply_blacklist_tier` → `apply_freq_tier` → `apply_always_topbox_tier` → Tier4; pushdown path updated; `drop_reasons` per tier.
  3. **Frontend:** `ConfigForm` four sections; Always-5 min n control; Pipeline steps table with Δ vs prev; chart lines after each tier; e2e scopes Network delta to KPI card.
  4. **Research tooling:** `scripts/export_store_research_excel.py` (`--all-tiers`, `--always-five-min-n`); `scripts/verify_research_excel.py`.
  5. **Guardrail:** `tier2_freq_threshold` minimum raised to **2** (threshold=1 would drop all identified respondents — verified on snapshot).
- **Verify**
  - `pytest tests/test_contracts.py tests/test_backend_poc.py tests/test_process_api.py tests/test_tier1.py`
  - `cd web && npm run test:run` / `npm run test:e2e`
  - Manual / snapshot: changing Tier2 freq or Tier3 min n changes Network delta as expected
- **Do not commit:** `docs/research/*.xlsx` (local manager exports), `data/*.sqlite`, `.env`

## [TASK-13] Period window + Network chart scope
- **Role:** Contract Engineer + Frontend Engineer + Drift Verifier
- **Status:** Done (Phases 1–4)
- **Branch:** `feat/period-and-network-scope`
- **Objective:** Optional `from_date`/`to_date` on `/process`; default AnswerTime window from 2025-01-01; Survey Data period presets; Store|Network chart scope (UX research v3). Do not regress 4-tier / `tier2_freq_threshold` ge=2.
- **Phase 1 (backend) — Done**
  1. `ProcessRequest.from_date` / `to_date` optional; `from_date > to_date` → 422.
  2. `source=db` wires window into Query A/B; default `DEFAULT_FROM_DATE=2025-01-01`.
  3. `meta.period_start` / `meta.period_end` echo effective window.
  4. Snapshot refresh default aligns with 2025-01-01 (`--from-date` override).
- **Phase 2 (UI period) — Done**
  1. Survey Data presets: `2026 YTD` · `2025 – Present` · `Custom Range`.
  2. `usePipelineRunner` sends resolved `from_date`/`to_date` for `source=db`.
  3. Synthetic sources: period control disabled (no-op).
- **Phase 3 (chart scope) — Done**
  1. Toolbar `[ Store | Network ]`; Network = volume-weighted aggregate from `store_impact_series`.
  2. Network: store select disabled + «Network aggregated»; no per-store Tier 4 overlays.
  3. Linear multi-year timeline (no YoY overlay).
- **Phase 4 (verify) — Done**
  1. Snapshot rebuilt with `--from-date 2025-01-01` (local only; do not commit).
  2. Backend/frontend tests green; eslint errors = 0 (PipelineStepsTable react-refresh warnings OK).
  3. Manual: 2025–Present vs 2026 YTD KPI/response counts diverge after refresh.
- **Out of scope (deferred):** persist nav; CHART_HEIGHT shared constant; store-funnel.
- **Experiment (branch ``feat/yoy-and-store-kpi``):** Store-scoped KPI strip + YoY overlay — keep or drop after customer feedback.
- **Verify**
  - `uv run pytest tests/test_process_api.py tests/test_snapshot.py tests/test_db_sample.py -q`
  - `cd web && npm run test:run` / `npm run lint`
  - Manual: period presets + Store|Network on Sanitization page
- **Do not commit:** `.env`, `data/*.sqlite`, `docs/research/*.xlsx`

## [TASK-12] UX Scenario Workbench (Datadog-inspired layout)
- **Role:** Frontend Engineer
- **Status:** Done (Phases 1–5)
- **Branch:** `feat/ux-scenario-workbench`
- **Objective:** Reshape the Sanitization page into a Scenario Lab workbench: fixed controls rail + independently scrolling results canvas. Phased experiments; do not regress 4-tier contract / `tier2_freq_threshold` ge=2 / API schemas.
- **Phases**
  | Phase | Scope | Status |
  |-------|--------|--------|
  | 1 | Shell & grid: left ~340px rail + right results, independent scroll on md+ | Done |
  | 2 | Controls rail: compact data source + config + Run in left footer | Done |
  | 3 | KPI + telemetry strip (4 cards) | Done |
  | 4 | Chart ‖ flagged table ~60/40 split | Done |
  | 5 | Pipeline steps funnel (collapsed audit) | Done |
- **Phase 1 delivered**
  - `DashboardLayout`: viewport-height flex chain (`100dvh`), outlet fills remaining space under header.
  - `SanitizationPage`: two-pane workbench; left controls scroll independently of right results on `md+`; stacked on `xs`.
- **Phase 2 delivered**
  - Left rail ~360px: scrollable Sample + Config; sticky **Run Scenario** footer.
  - `SampleDataPanel`: compact Data source select (db / small / medium / stress) + Reload from DB.
  - `ConfigForm`: single-column four-tier layout for narrow rail.
  - `usePipelineRunner` shared hook; `PipelineRunPanel` is results-only.
- **Phase 3 delivered**
  - `KpiCards` verdict strip: Baseline / Final / Network delta (signed color) / Run telemetry (time, RAM, rows; optional Query A/B).
  - Removed standalone `TelemetryMetaCard`; strip sits above the chart (`grid` 4-col md, 2×2 sm).
- **Phase 4 delivered**
  - Explore split (`md` 7/5 ≈ 60/40): `StoreImpactChart` ‖ `FlaggedMonthsTable` (`variant="panel"`).
  - Flagged table no longer in accordion; click row still focuses store + month on chart via `uiStore`.
- **Phase 5 delivered**
  - Pipeline steps **funnel** accordion, **collapsed by default**; summary shows largest |Δ vs prev|.
  - Micro-bar on Excluded (share of rows_in); largest-Δ row highlighted (★).
  - Full five steps preserved (`actual` → `tier1`…`tier4`).
- **Verify**
  - Manual: funnel collapsed; expand → bars + ★ on biggest KPI step contribution.
  - `cd web && npm run test:run`
- **Do not commit:** `.env`, `data/*.sqlite`, `docs/research/*.xlsx`
