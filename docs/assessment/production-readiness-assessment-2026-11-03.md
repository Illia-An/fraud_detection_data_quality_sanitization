# Production Readiness & Technical Debt Assessment

**Repository:** `Fraud_Fetection_Data_Quality_Sanitization` (`main` @ `cd22d52`, tag line up to `v1.30.0-tts-kpi-snapshot`)
**Date:** 2026-11-03
**Scope:** assessment only — no application code was modified.

## What was actually inspected and executed

| Activity | Done | Notes |
|---|---|---|
| Repository structure, git history, tags, branches, remotes | Yes | 338 tracked files; remote `github.com/Illia-An/...` |
| Backend source (`backend/`, `db/`, `api/`, `src/`) | Yes, read in full for all runtime modules | `fraud_guard/tier3.py`, `synthetic.py`, `aggregate.py`, `tts_kitchen/*` only skimmed |
| Scripts (`scripts/refresh_*_snapshot.py`) | Yes | Other export scripts only listed |
| Frontend (`web/`) | Partially | `api/`, `providers/`, `schemas/period.ts`, `App.tsx`, e2e specs, Playwright config. Page components only sized, not read |
| Docker, compose, CI, env templates, ignore files | Yes | |
| `uv run python -m pytest tests/ -q` | Executed | **129 passed**, 1 deprecation warning |
| `npm run lint` | Executed | **0 errors, 9 warnings** |
| `npm run test:run` | Executed | **70 files / 290 tests passed** |
| `npm audit --omit=dev` | Executed | **4 critical, 1 high** |
| `uv lock --check` | Executed | Lock is consistent with `pyproject.toml` |
| Playwright e2e | **Not executed** | |
| Docker build / run | **Not executed** | |
| Python dependency CVE scan | **Not executed** | No scanner in the project; none added per instructions |
| Live SQL Server / AP / DreamFactory | **Not accessed** | |

Findings are labelled **Confirmed** (seen in code/output), **Potential** (code pattern that is risky but impact not demonstrated), or **Recommendation**.

---

## A. Executive Summary

### Current architectural state

A single-process **FastAPI + React (Vite) monolith** for internal analytics: a Q10012 survey "5% top-box" sanitization what-if engine, two KPI planners (five_percent and TTS minutes), and a kitchen TTS before/after view that the UI currently shows as "coming soon". All data access is **read-only**. In Docker the app reads **two local SQLite snapshot files** produced by manually run refresh scripts on a host that can reach SQL Server; the container itself cannot talk to SQL Server (no ODBC driver in the image).

### Overall technical health

**Good MVP, not production-ready.** The core domain logic is pure, well-commented and well-tested. The gaps are almost entirely in the "production envelope": security, data handling of PII, observability, operations, and a few correctness-relevant design shortcuts.

### Main strengths

- Clear separation between pure domain logic (`src/fraud_guard`, `src/planner`, `src/tts_kitchen`) and the HTTP layer (`backend/`).
- Strong automated tests: 129 backend tests, 290 frontend unit tests, Playwright e2e in CI, all green.
- Parameterised SQL everywhere; table/view names from env are validated against identifier regexes (`planner/tts_kpi_ap.qualify_table`, `tts_kitchen_queries._require_view_name`).
- Explicit "Query A / Query B" pushdown design that avoids pulling raw period data, with KPI-parity tests (`tests/test_query_b.py`, `tests/test_query_b_phase2.py`).
- Secrets hygiene in the working tree is good: `.env*` gitignored and not tracked; error messages deliberately avoid leaking URLs/keys (`backend/tts_kpi_ap.py`).
- Zod schemas on the frontend mirror Pydantic contracts and validate every API response.

### Main weaknesses

- **No authentication or authorization** on any endpoint.
- **PII handling**: raw phone numbers in committed notebook outputs; raw PII stored in plaintext SQLite snapshots; unsalted hashing.
- **Data-source-dependent business results**: the SQL Server VIEW path runs only the blacklist rule, the snapshot path runs all rules — same API, different KPI.
- **Operations are manual**: snapshot refresh, deployment, rollback, freshness monitoring are all human steps without procedures.
- **Observability is minimal**: no logging configuration, no metrics, liveness-only health check.

### Biggest production risks

1. PII already present in git history pushed to GitHub (SEC-01).
2. Unauthenticated API serving PII-derived data on a LAN-bound container (SEC-02, SEC-04).
3. Stakeholders seeing different "sanitized 5%" numbers depending on a deployment env var (ARCH-01).
4. Stale data with no detection — snapshots refreshed by hand, no freshness alert, hardcoded date windows (DATA-04, ARCH-10).

---

## B. Architecture Overview

### Technology stack

| Layer | Technology | Evidence |
|---|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, pandas, SQLAlchemy 2, pyodbc, httpx | `pyproject.toml`, `.python-version` |
| Research-only deps shipped at runtime | scikit-learn, openpyxl | `pyproject.toml` `dependencies` |
| Frontend | React 19, Vite 6, MUI 6, TanStack Query/Table, Zustand, Zod 3, Plotly 3, react-router 7 | `web/package.json` |
| Data sources | SQL Server VIEW `dbo.TargetsByMetrics_RateGetAnswers`; MC view `dbo.TargetsByMetrics_McKitiBump`; AP table `AP.dbo.T_KPITrendAlerts` (SQL or DreamFactory); local SQLite snapshots | `backend/db_sample.py`, `backend/tts_kitchen_queries.py`, `src/planner/tts_kpi_ap.py` |
| Packaging | uv + hatchling; Docker multi-stage (node 20 → python 3.12-slim) | `Dockerfile` |
| CI | GitHub Actions: pytest, eslint, vitest, vite build, Playwright | `.github/workflows/ci.yml` |

### Components

```text
web/ (React SPA)  ──fetch──►  backend/main.py (FastAPI, create_app)
                                 │
   ┌─────────────────────────────┼───────────────────────────────┬──────────────────────┐
   │ /api/v1/process             │ /api/v1/plans, /plans-tts     │ /api/v1/tts-kpi/ap   │ /api/v1/tts-kitchen/before-after
   ▼                             ▼                               ▼                      ▼
backend/service.py          src/planner/five_percent.py    backend/tts_kpi_ap.py   backend/tts_kitchen_service.py
 run_pipeline (inline)      src/planner/tts.py              ├ snapshot (SQLite)     └ tts_kitchen_queries.py (MSSQL only)
 run_pipeline_pushdown(db)  (pure, stateless)               ├ sql (MSSQL)              src/tts_kitchen/{fold,report}.py
   │                                                        └ dreamfactory (HTTP)
   ├ backend/queries.py  Query A (aggregates) + Query B (candidates)
   ├ backend/db_sample.py  period filters, PII redaction, engine selection
   ├ backend/snapshot.py   SQLite Q10012 snapshot
   └ src/fraud_guard/tier1.py, tier2.py  (pure pandas rules)

backend/static_ui.py  ── SPA catch-all serving web/dist (Docker monolith)
api/main.py           ── legacy second FastAPI app (health only, port 8000)
scripts/refresh_*     ── manual SQL Server / AP → SQLite full reloads
notebooks/            ── research (tracked, with outputs)
```

### Main data flows

1. **Sanitization, `source=db`** (`backend/main.py` `process`):
   `_process_engine()` picks the VIEW (MSSQL) or SQLite snapshot by `SANITIZATION_SOURCE` → Query A returns store×month totals → Query B returns only candidate rows → PII hashed in `redact_row` → `run_pipeline_pushdown` subtracts candidate drops from Query A cells → Tier 4 on aggregates → `SanitizationResponse` (aggregates only, no rows).
2. **Sanitization, inline**: browser fetches synthetic rows from `/sample/{preset}`, posts them back to `/process` → `run_pipeline` runs all tiers in pandas.
3. **Planners**: browser posts a baseline (from sanitization output or the TTS panel) → pure allocation function → projections. Nothing is persisted server-side; the UI keeps state in `sessionStorage` (`web/src/store/sessionPersist.ts`).
4. **Snapshot refresh** (out of band): a developer runs `scripts/refresh_q10012_snapshot.py` / `refresh_tts_kpi_snapshot.py` on a host with SQL Server access; files are bind-mounted read-only into the container.

### Persistence

There is **no application database of record**. The only writable stores are the SQLite snapshot files (written by scripts) and browser `sessionStorage`.

---

## C. Technical Debt Register

Severity scale: Critical / High / Medium / Low. Effort: S (≤1 day), M (2–5 days), L (1–3 weeks), XL (>3 weeks).

### Security

**SEC-01 — Raw phone numbers committed in notebook outputs** (Confirmed)
- **Description:** `notebooks/03_tier3_experiments.ipynb` contains 15 rendered DataFrame rows whose entity key is `c:<mobile number>` — unhashed contact values. Present since the initial commit `c4c5fb4` and pushed to the GitHub remote.
- **Evidence:** `git grep -E "\b05[0-9]-?[0-9]{7}\b" notebooks/03_tier3_experiments.ipynb` → lines 149–155, 294–298 (values masked during review). All four notebooks are committed with outputs (17/14/6/4 output cells).
- **Impact:** PII exposure to anyone with repo access, including forks/clones; likely a privacy-regulation reportable issue depending on repo visibility.
- **Likelihood:** Already happened. **Severity:** Critical.
- **Recommended action:** Confirm repo visibility and who has cloned it; strip outputs; purge from history (`git filter-repo`) with coordinated force-push (needs explicit owner approval — it rewrites `main`); add an output-stripping pre-commit hook or CI check; scan the other notebooks and `docs/` the same way.
- **Effort:** M. **Dependencies:** owner/legal decision on history rewrite. **Confidence:** High.

**SEC-02 — No authentication or authorization** (Confirmed)
- **Description:** No auth dependency, middleware, or API key check exists on any route. The container binds `0.0.0.0:8000` (`Dockerfile` CMD) and README describes LAN usage.
- **Evidence:** `backend/main.py` routes have no `Depends`/security; grep for `auth|token|Depends(` in `backend/` finds only the outbound DreamFactory key.
- **Impact:** Anyone on the network can read survey-derived KPIs, store-level results, AP KPI data, and trigger expensive queries against production SQL Server (when `SANITIZATION_SOURCE=view`).
- **Likelihood:** High once deployed beyond a single laptop. **Severity:** High.
- **Recommended action:** Put the app behind the organisation's SSO (reverse proxy with OIDC, or FastAPI dependency validating tokens). Decide whether per-role access is needed (open question G-2).
- **Effort:** M. **Dependencies:** identity provider choice. **Confidence:** High.

**SEC-03 — Raw PII stored in plaintext SQLite snapshot** (Confirmed)
- **Description:** `answers` table stores `UserContact` and `PhoneFromLog` as raw text; hashing happens only after reading. The local file is ~190 MB.
- **Evidence:** `backend/snapshot.py` `_SCHEMA_SQL`; `scripts/refresh_q10012_snapshot.py` lines 163–164 insert raw values; module docstring "PII may be stored locally".
- **Impact:** Laptop/host loss or container compromise leaks full PII; contradicts SPEC Invariant 1's intent ("hash before grouping").
- **Likelihood:** Medium. **Severity:** High.
- **Recommended action:** Hash (keyed, see SEC-04) at refresh time so the snapshot never holds raw PII. The SQLite entity-key CASE expression in `backend/queries.py` would then operate on hashed values — behaviour is preserved because grouping only needs equality.
- **Effort:** S–M. **Dependencies:** SEC-04 (choose hash scheme once). **Confidence:** High.

**SEC-04 — Unsalted SHA-256 pseudonymisation of phone numbers** (Confirmed pattern / Potential impact)
- **Description:** `hash_pii_value` is plain SHA-256 truncated to 32 hex chars. The phone-number space is small enough to enumerate, so hashes are reversible.
- **Evidence:** `src/fraud_guard/pii.py` line 25.
- **Impact:** Today hashes are not returned by `/process` (response is aggregates only), so exposure is limited to memory and any future logs/exports. Becomes material if hashed keys are exported (e.g. `scripts/export_always5_entities.py` — not reviewed in depth).
- **Likelihood:** Low today. **Severity:** Medium.
- **Recommended action:** Switch to HMAC-SHA256 with a secret pepper from env. Keep the 32-char length so contracts don't change.
- **Effort:** S. **Dependencies:** secrets distribution. **Confidence:** High on the pattern.

**SEC-05 — SPA catch-all has no path containment check** (Potential)
- **Description:** `spa_fallback` serves `root / full_path` if it is a file, without verifying the resolved path stays inside `root`. Starlette's own `StaticFiles` performs this check; this custom handler does not.
- **Evidence:** `backend/static_ui.py` lines 38–43.
- **Impact:** If a request path containing `..` segments reaches the handler un-normalised, arbitrary readable files in the container (including mounted snapshots) could be served. Not exploited or tested during this review.
- **Likelihood:** Unknown (depends on server/proxy normalisation). **Severity:** High if exploitable.
- **Recommended action:** Resolve the candidate and require `candidate.resolve().is_relative_to(root)`, or use `StaticFiles(html=True)` plus a 404→index fallback. Add a regression test with an encoded `..` path.
- **Effort:** S. **Dependencies:** none. **Confidence:** Medium.

**SEC-06 — Vulnerable frontend dependencies** (Confirmed)
- **Description:** `npm audit --omit=dev`: `maplibre-gl` (critical XSS, via `plotly.js`), `seroval`/`solid-js` (critical, via `@tanstack/react-query-devtools`), `zod <4.6.6` (high, memory exhaustion).
- **Evidence:** audit output; `web/package.json`.
- **Impact:** Practical exploitability looks low: devtools are rendered only when `import.meta.env.DEV` (`web/src/providers/AppProviders.tsx`), maplibre is only used by Plotly map traces (none observed), Zod runs client-side on trusted API responses. Still a compliance blocker in most production gates.
- **Likelihood:** Low. **Severity:** Medium.
- **Recommended action:** Move `@tanstack/react-query-devtools` to `devDependencies`; evaluate Plotly 4 / `plotly.js-basic-dist` (no maplibre); plan Zod 4 migration separately (breaking).
- **Effort:** S (devtools) / M (Plotly) / M (Zod). **Confidence:** High.

**SEC-07 — No request size limits on unauthenticated endpoints** (Confirmed)
- **Description:** `ProcessRequest.rows` allows up to 500,000 rows and `SurveyAnswerRow` uses `extra="allow"`; plan `baseline_rows` lists have no upper bound; no body-size limit at server level.
- **Evidence:** `backend/schemas.py` lines 70, 100; `backend/tts_plan_schemas.py` line 42; `backend/plan_schemas.py`.
- **Impact:** A single request can exhaust memory/CPU of the only process (DoS).
- **Likelihood:** Medium when combined with SEC-02. **Severity:** Medium.
- **Recommended action:** Lower `max_length` to what the UI needs (largest synthetic preset), set `extra="ignore"` or bound extra fields, cap `baseline_rows`, and set a proxy body limit.
- **Effort:** S. **Dependencies:** confirm UI maximums. **Confidence:** High.

**SEC-08 — Container runs as root** (Confirmed)
- **Evidence:** `Dockerfile` has no `USER` directive.
- **Impact/Severity:** Low–Medium (amplifies SEC-05).
- **Action:** Add a non-root user. **Effort:** S. **Confidence:** High.

### Architecture & design

**ARCH-01 — Sanitization results depend on the data source** (Confirmed, intentional but undisclosed to users)
- **Description:** With `SANITIZATION_SOURCE=view` (SQL Server), Query B is "blacklist only"; frequency (tier 2) and always-5 (tier 3) are silently skipped even if enabled in the request. With `snapshot`, all tiers run. The same UI and config therefore produce different "final 5%".
- **Evidence:** `backend/queries.py` `query_b_mode_for_dialect` (line 276); `backend/service.py` lines 475, 510, 522 (`tiers_23_on_candidates and ...`); `tests/test_query_b_phase2.py::test_mssql_v1_still_blacklist_only_no_freq` locks this in; SPEC §5.2 documents it as v1.
- **Impact:** Business KPI inconsistency between environments; tier toggles appear to work but have no effect on the VIEW path.
- **Likelihood:** High if production uses the VIEW. **Severity:** High.
- **Recommended action:** Business decision (G-1). Options: (a) production uses snapshot/physical tables only and VIEW mode is disabled; (b) return 422 or a visible warning when tiers 2–3 are enabled on the VIEW path; (c) implement DBA-backed physical tables per SPEC §5.4.
- **Effort:** S for (a)/(b), L for (c). **Confidence:** High.

**ARCH-02 — Query A / Query B period granularity mismatch on snapshot** (Confirmed in code; magnitude not measured)
- **Description:** On SQLite, Query A reads pre-aggregated `store_month` filtered by **calendar month**, while Query B filters `answers` by **day** (`AnswerTime`). For a mid-month `from_date`/`to_date`, Query A includes the whole month but drops are only subtracted for the partial range.
- **Evidence:** `backend/queries.py` `_store_month_period_clause` docstring (lines 119–123) vs `_period_params` in `backend/db_sample.py`; UI sends mid-month dates for `ytd_2026` (`to_date` = today) and custom ranges (`web/src/schemas/period.ts`).
- **Impact:** Baseline and sanitized % are computed on different populations in boundary months. For `ytd_2026` the effect is small (future days have no data); for custom ranges it can be material.
- **Likelihood:** Medium. **Severity:** Medium.
- **Recommended action:** Either restrict snapshot date inputs to month boundaries, or compute Query A from `answers` for partial boundary months. Add a parity test with a mid-month range.
- **Effort:** S–M. **Confidence:** High on mechanism.

**ARCH-03 — Configuration is scattered and inconsistent** (Confirmed)
- **Description:** Env vars are read directly with `os.environ.get` in at least 7 modules; `load_dotenv` is called in `backend/main.py`, `db/config.py`, `api/main.py` and scripts; defaults disagree (CORS `5173,4201` in `backend/main.py` vs `4200` in `db/config.py` and `api/main.py`). `db/config.get_settings()` raises if `DATABASE_URL` is empty even when only `TTS_DATABASE_URL` is needed (`backend/tts_kitchen_queries.py` line 176). Scripts mutate `os.environ` at runtime (`refresh_tts_kpi_snapshot` line 227).
- **Impact:** Hard to know the effective configuration of a deployment; misconfiguration surfaces only at request time.
- **Severity:** Medium. **Recommended action:** One typed settings object loaded at startup, validated, and logged (without secrets). **Effort:** M. **Confidence:** High.

**ARCH-04 — Engine created per request; no timeouts or pool hygiene** (Confirmed pattern / Potential impact)
- **Description:** `db.connection.get_engine()` and `get_tts_engine()` call `create_engine` on every request; the Q10012 snapshot engine is also recreated per call (`require_snapshot_engine`) and never disposed (the TTS paths do dispose). No `pool_pre_ping`, no query/login timeouts on SQL Server connections.
- **Evidence:** `db/connection.py`; `backend/db_sample.py` `_engine_from_settings`; `backend/snapshot.py` `require_snapshot_engine`.
- **Impact:** Connection churn against SQL Server, no reuse, lingering pools until GC; a slow VIEW query can hold a worker thread indefinitely.
- **Severity:** Medium (High if VIEW mode is used in production). **Action:** Cache one engine per URL for the process lifetime, dispose on shutdown (FastAPI lifespan), set ODBC/statement timeouts. **Effort:** S–M. **Confidence:** High.

**ARCH-05 — Tier naming drift between modules and pipeline steps** (Confirmed)
- **Description:** `fraud_guard/tier1.py` implements pipeline tiers 1–3; `fraud_guard/tier2.py` implements pipeline tier 4; `fraud_guard/tier3.py` is an IsolationForest research tier not used by the API. Legacy config keys are migrated in `src/schemas/pipeline.py`.
- **Impact:** High onboarding cost and risk of wiring the wrong rule. **Severity:** Medium. **Action:** Rename/re-export modules to match pipeline steps while keeping old import paths as aliases. **Effort:** M. **Confidence:** High.

**ARCH-06 — Research dependencies loaded in the API process** (Confirmed)
- **Description:** `src/fraud_guard/__init__.py` imports `tier3`, which imports scikit-learn. Any `from fraud_guard.x import ...` in the backend (e.g. `fraud_guard.synthetic`, `fraud_guard.pii`) executes the package `__init__`, so sklearn is loaded at API startup. `scikit-learn` and `openpyxl` are runtime dependencies although only `tier3.py` and scripts use them.
- **Impact:** Larger image, slower start, larger dependency attack surface. **Severity:** Low–Medium. **Action:** Make `__init__` lazy or stop re-exporting tier3; move sklearn/openpyxl/matplotlib to an optional `research` extra. **Effort:** S. **Confidence:** High.

**ARCH-07 — Packaging and manifest drift** (Confirmed)
- **Description:** `pyproject.toml` wheel packages list `src/tts_guard` and `src/tts_order_bump`, which no longer exist (removed in "product trim", `3df409e`). `backend/requirements.txt` omits `sqlalchemy`, `pyodbc`, `httpx`, `openpyxl`. Top-level package names `schemas`, `planner`, `db`, `backend` are generic and collision-prone. App reports version `0.1.0` while releases are tagged up to `v1.30.0`.
- **Impact:** Confusing builds; anyone using `requirements.txt` gets a broken install; version in `/health` is meaningless for incident triage. **Severity:** Low–Medium. **Action:** Remove stale entries, delete or regenerate `requirements.txt`, single-source the version. **Effort:** S. **Confidence:** High (impact of missing hatch paths on builds not verified).

**ARCH-08 — Legacy second API app** (Confirmed)
- **Description:** `api/main.py` is a separate FastAPI app with only `/api/v1/health`; still documented in README and covered by `tests/test_health.py`.
- **Severity:** Low. **Action:** Remove after confirming no consumer (G-6). **Effort:** S.

**ARCH-09 — Hardcoded business dates** (Confirmed)
- **Description:** Kitchen window `2026-09-01..2026-10-20` (`backend/tts_kitchen_queries.py` lines 24–25); `DEFAULT_FROM_DATE = 2025-01-01` (`backend/db_sample.py`); UI preset `ytd_2026` hardcodes `2026-01-01` (`web/src/schemas/period.ts`).
- **Impact:** On 2027-01-01 "2026 YTD" becomes a past range with a misleading label; kitchen data never advances. **Severity:** Medium. **Action:** Derive from current date or config. **Effort:** S. **Confidence:** High.

**ARCH-10 — Private helpers used across modules** (Confirmed)
- **Evidence:** `backend/queries.py` imports `_period_params`, `_process_engine` from `backend/db_sample.py`; `scripts/refresh_q10012_snapshot.py` imports `_engine_from_settings`. Several function-local imports exist to dodge circular imports (`backend/db_sample.py` lines 242, 256, 265).
- **Severity:** Low. **Action:** Extract a small `data_access` module with public functions. **Effort:** S–M.

### Code quality & maintainability

**CODE-01 — Duplicated planner and snapshot logic** (Confirmed)
- **Evidence:** `src/planner/tts.py` mirrors `src/planner/five_percent.py` almost line-for-line with the sign flipped; `backend/main.py` duplicates the plan→response mapping for both planners (lines 386–406 vs 435–455); `backend/snapshot.py` vs `backend/tts_kpi_snapshot.py` duplicate path resolution, meta read/write, and engine setup. Frontend pages `PlannerPage.tsx` (1,221 lines) and `TtsPlannerPage.tsx` (1,163 lines) appear to be parallel implementations (sizes only; not diffed).
- **Impact:** Fixes must be applied twice; drift already visible (TTS validates `floor >= ceiling`, five_percent does not). **Severity:** Medium. **Action:** Extract a direction-aware allocator shared by both planners, guarded by the existing tests. **Effort:** M. **Confidence:** High (backend), Medium (frontend).

**CODE-02 — Large, multi-responsibility modules** (Confirmed)
- **Evidence:** `backend/main.py` defines every route inside `create_app` (460 lines); `backend/service.py` 645 lines; frontend `StoreAuditDrawer.tsx` 823, `HeroSimulationChart.tsx` 691 lines.
- **Severity:** Medium. **Action:** Split routes into `APIRouter`s per domain (sanitization, planners, tts); no behaviour change. **Effort:** M.

**CODE-03 — PII re-hashed at every tier step** (Confirmed)
- **Description:** `_prepare_tier_frame` calls `ensure_pii_hashed` in each `apply_*_tier`; the pipeline calls three of these in sequence, and the pushdown path has already hashed in `redact_row`. Values end up hashed 2–4 times. Results stay consistent because all rows at a given step receive the same number of hashes, but this contradicts the docstring ("call once at pipeline entry") and wastes CPU.
- **Evidence:** `src/fraud_guard/tier1.py` lines 204–213, 216–255; `src/fraud_guard/pii.py` lines 28–36; `backend/service.py` lines 493–526.
- **Impact:** Latent correctness trap if any future code mixes rows from different steps or compares against externally hashed keys. **Severity:** Low–Medium. **Action:** Hash once at entry and pass a flag/frame that is already prepared. **Effort:** S. **Confidence:** High.

**CODE-04 — No Python static analysis in CI** (Confirmed)
- **Evidence:** no ruff/flake8/mypy/pyright configuration in `pyproject.toml` or `ci.yml`; untyped `apply_fn` parameters and `# type: ignore` in `backend/service.py`.
- **Severity:** Low–Medium. **Action:** Add ruff + a type checker as dev tools (requires approval for new dev deps). **Effort:** S.

**CODE-05 — Frontend lint warnings** (Confirmed)
- **Evidence:** 9 warnings, including `react-hooks/exhaustive-deps` in three pages.
- **Severity:** Low. **Action:** Fix or justify; then make CI fail on warnings. **Effort:** S.

### Data layer

**DATA-01 — Snapshot refresh is in-place and unvalidated** (Confirmed)
- **Description:** Both refresh scripts `DELETE` and re-insert inside the live file (single transaction — good), with no write-to-temp-and-swap, no previous-version backup, and no validation (e.g. row count vs. source, minimum rows) before the new data becomes visible.
- **Evidence:** `scripts/refresh_q10012_snapshot.py` lines 147–180; `backend/tts_kpi_snapshot.py` lines 260–283.
- **Impact:** A partial/empty pull from the source (e.g. VIEW returns 0 rows) silently replaces good data; a long write transaction blocks readers in the running container. **Severity:** Medium. **Action:** Build to `*.tmp`, validate, then atomic rename (note: single-file bind mounts pin the inode — mount the `data/` directory instead). Keep N previous files. **Effort:** S–M. **Confidence:** High.

**DATA-02 — No schema migration strategy for snapshots** (Confirmed)
- **Evidence:** `CREATE TABLE IF NOT EXISTS` only (`backend/snapshot.py`, `backend/tts_kpi_snapshot.py`); no schema version in `snapshot_meta`.
- **Impact:** Adding a column will not apply to existing files; the app will fail at query time. Mitigated by full reload. **Severity:** Low. **Action:** Write a `schema_version` key and check it in `require_*_snapshot_engine`. **Effort:** S.

**DATA-03 — Indexing for phase-2 Query B** (Potential)
- **Evidence:** `answers` indexes are `(AnswerTime)`, `(BlackList, AnswerTime)`, `(PrintStore, Year, Month)` (`backend/snapshot.py`). Query B phase 2 filters by `Question_ID` + `AnswerTime` and groups by a computed entity key over the whole period. Timing was not measured.
- **Severity:** Low. **Action:** Use the existing `db_query_b_time_ms` telemetry to decide; consider a precomputed `entity_key` column at refresh time. **Effort:** S.

**DATA-04 — No freshness enforcement** (Confirmed)
- **Description:** Snapshot `loaded_at` is shown in metadata but nothing alerts or blocks when data is stale. Docker `HEALTHCHECK` hits `/health`, which returns a static `{"status":"ok"}`.
- **Evidence:** `backend/schemas.py` `HealthResponse`; `Dockerfile` `HEALTHCHECK`.
- **Severity:** Medium. **Action:** Readiness endpoint reporting snapshot presence, age, and row counts; alert above a threshold. **Effort:** S.

**DATA-05 — No persistence of plans or runs** (Confirmed; may be by design)
- **Description:** Plans and sanitization configs live only in browser `sessionStorage`; no audit trail of which thresholds produced which published number.
- **Severity:** Depends on G-4. **Effort:** L if required.

N+1 queries: **none found**. Each endpoint issues at most two queries (Query A + B) or one (kitchen, TTS).

### Performance & scalability

**PERF-01 — Global `tracemalloc` profiling on every `/process` call** (Confirmed)
- **Description:** `profile_block` starts/stops the process-global `tracemalloc` per request. FastAPI runs sync endpoints in a thread pool, so concurrent requests share tracing state: one request can stop tracing while another is measuring, and all threads pay tracemalloc's allocation overhead while any request is in flight.
- **Evidence:** `backend/profiler.py` lines 31–51; `backend/main.py` line 266.
- **Impact:** Slower `/process`, unreliable `peak_memory_mb` under concurrency. **Severity:** Medium. **Action:** Keep wall-clock timing; gate tracemalloc behind a debug flag. **Effort:** S. **Confidence:** High on mechanism; overhead not measured.

**PERF-02 — Row-wise pandas loops in the inline path** (Confirmed)
- **Evidence:** `backend/service.py` `_build_store_impact_series._lookup` filters the full panel for each cell × 4 stages (quadratic in store×month cells); `iterrows` in `_drop_counts_by_cell` and `_store_month_cells`; list comprehension over all rows in `tier2.apply_tier2` line 111.
- **Severity:** Low (synthetic presets are small). **Action:** Replace with merges/groupby if inline volumes grow. **Effort:** S.

**PERF-03 — Unbounded Query B result on the VIEW path** (Potential)
- **Description:** VIEW-mode Query B loads every non-customer-segment row for the period into memory, then pandas. No row cap, no timeout (see ARCH-04).
- **Severity:** Medium if VIEW mode is used. **Action:** Timeouts + a row ceiling returning 422/503 with a clear message. **Effort:** S.

**PERF-04 — No caching of deterministic snapshot results** (Recommendation)
- Snapshot data changes once per refresh; identical `(config, period)` requests could be memoised keyed by `loaded_at`. **Effort:** S–M. Only worth it if latency is a complaint.

Concurrency model: single uvicorn process, no `--workers`, sync handlers on the default thread pool. Adequate for a small internal audience; no shared mutable state other than PERF-01.

### Observability & reliability

**OBS-01 — No logging configuration** (Confirmed)
- **Description:** The backend never configures logging. Application loggers (`backend.*`) have no handlers; INFO messages (e.g. "Mounted frontend SPA") are dropped, and `logger.exception` output falls back to Python's last-resort stderr handler without timestamps or context. No request IDs, no structured format.
- **Evidence:** no `basicConfig`/`dictConfig` in `backend/`, `db/`, `src/`; scripts do configure logging.
- **Severity:** High for production. **Action:** Configure logging at startup (JSON to stdout), add a request-ID middleware, log route, status and duration. Keep the existing "no PII in logs" rule. **Effort:** S–M.

**OBS-02 — No error tracking or metrics** (Confirmed)
- No Sentry/OpenTelemetry/Prometheus. The useful `meta` telemetry (`execution_time_ms`, `db_query_*_time_ms`) only reaches the browser.
- **Severity:** Medium. **Action:** Emit these as logs/metrics server-side first; add a tracker once a platform is chosen (G-5). **Effort:** M.

**OBS-03 — Liveness only; no readiness or lifecycle hooks** (Confirmed)
- `/health` is static; no FastAPI lifespan for startup validation or engine disposal. uvicorn handles SIGTERM gracefully by default, which is sufficient for stateless requests.
- **Severity:** Medium. **Action:** See DATA-04; add lifespan for config validation + engine cleanup. **Effort:** S.

Failure handling is generally sound: DB errors map to 503 with generic messages, validation to 422, unexpected errors to 500 with `logger.exception` (`backend/main.py` lines 352–360, 476–487).

### Infrastructure & deployment

**INFRA-01 — Container cannot reach SQL Server; production data path is a manual snapshot** (Confirmed)
- **Description:** The runtime image has no ODBC driver (`python:3.12-slim` without `msodbcsql`/`unixodbc`), so `view`, `sql` and kitchen modes cannot work in Docker. Data enters only via a person running refresh scripts on a host with VPN/Trusted Connection access.
- **Evidence:** `Dockerfile`; README "Docker" section; `.env.docker.example`.
- **Impact:** Single point of failure (one person/host), no schedule, data staleness. **Severity:** High. **Action:** Decide target data path (G-3). Short-term: scheduled refresh job with alerting; long-term: DBA-owned physical tables (SPEC §5.4) or service account access from the container. **Effort:** M–L.

**INFRA-02 — No deployment pipeline, release, or rollback procedure** (Confirmed)
- **Description:** CI tests but does not build the Docker image, scan it, or publish it. Deployment is `docker compose build && up` on a host; the image tag is always `:local`. Rollback relies on rebuilding an older git tag.
- **Evidence:** `.github/workflows/ci.yml`, `docker-compose.yml`, README.
- **Severity:** High. **Action:** CI job that builds the image, tags it with the git tag/SHA, pushes to a registry; deploy by tag; document rollback as "redeploy previous tag". **Effort:** M.

**INFRA-03 — Environment inconsistency** (Confirmed)
- CI uses Node 22, Dockerfile uses Node 20. CI pushes run only for `main`, `feat/react-ui-v2`, `feat/db-sample-2026` (two of which are stale). `uv` pinned to `0.6.14` in Docker but unpinned in CI. Project rules ask for Python 3.13+, but the project is on 3.12 (`.python-version`, `requires-python >=3.12`).
- **Severity:** Low–Medium. **Action:** Align Node versions; trim CI branch list; decide on Python version. **Effort:** S.

**INFRA-04 — Repository hygiene** (Confirmed)
- A Word lock file is tracked: `docs/tts_full_view_for_proj/~$cument 2. Technical Specification.docx`. Untracked leftover `frontend/` folder with `node_modules`. 48 local branches (44 merged). Root contains several planning docs (`TASKS.md`, `SPEC-*.md`, `COLUMN_AUDIT_*.md`).
- **Severity:** Low. **Action:** Remove lock file, prune merged branches, move planning docs under `docs/`. **Effort:** S.

**INFRA-05 — No backup/restore for snapshots** (Confirmed)
- Snapshots are rebuildable from source, so loss means downtime rather than data loss, as long as the source remains reachable. See DATA-01 for keeping previous versions.

### Testing

**TEST-01 — Strong unit coverage of pure logic** (Confirmed strength)
- 129 backend tests cover tiers, pushdown parity, query builders, snapshot, TTS, kitchen, API contracts; 290 frontend tests; Playwright e2e for sanitization and planner.

**TEST-02 — Gaps in regression protection** (Confirmed)
- No coverage measurement (no `pytest-cov`/vitest coverage thresholds in CI).
- MSSQL SQL text is only string-asserted; it is never executed in CI (README: "No live SQL Server in CI").
- No security regression tests (path traversal, payload size, auth).
- E2E covers synthetic presets only; no e2e for `source=db` via snapshot fixture, TTS planner, or Docker image.
- No test of the mid-month boundary case (ARCH-02).
- `tests/test_health.py` tests the legacy `api/` app, not `backend.main` `/health` (backend health is covered indirectly).
- **Severity:** Medium. **Action:** Add a tiny committed synthetic SQLite snapshot fixture and run e2e/Docker smoke against it; add the regression tests listed above. **Effort:** M.

**TEST-03 — Starlette TestClient deprecation** (Confirmed)
- Warning: "Using `httpx` with `starlette.testclient` is deprecated". **Severity:** Low. **Effort:** S.

---

## D. Production Readiness Assessment

| Area | Rating | Evidence |
|---|---|---|
| 1. Architecture & design | **Needs improvement** | Clean pure-logic/HTTP split and pushdown design (strengths). Source-dependent results (ARCH-01), granularity mismatch (ARCH-02), scattered config (ARCH-03), engine-per-request (ARCH-04). |
| 2. Code quality & maintainability | **Needs improvement** | Good docstrings and typing in domain code; duplication (CODE-01), large modules (CODE-02), naming drift (ARCH-05), no Python linting (CODE-04). |
| 3. Database & data layer | **Needs improvement** | Read-only, parameterised, no N+1. In-place unvalidated refresh (DATA-01), no freshness check (DATA-04), no timeouts (ARCH-04). No application DB exists, so schema/migration concerns are limited to snapshots. |
| 4. Security | **Not ready** | PII in git history (SEC-01), no auth (SEC-02), plaintext PII at rest (SEC-03), unsalted hashing (SEC-04), possible path traversal (SEC-05), critical npm advisories (SEC-06). Python CVE scan not assessed. |
| 5. Testing strategy | **Needs improvement** | All suites green and broad on logic; missing coverage metrics, DB-path e2e, security and boundary tests (TEST-02). Playwright not run in this review. |
| 6. Performance & scalability | **Needs improvement** | Acceptable for a small internal audience; global tracemalloc (PERF-01), unbounded VIEW Query B (PERF-03). No load testing exists or was performed. |
| 7. Observability & reliability | **Not ready** | No logging config (OBS-01), no metrics/error tracking (OBS-02), static health check (OBS-03). Error-to-status mapping is good. |
| 8. Infrastructure & deployment | **Not ready** | No image build/publish in CI, no rollback procedure (INFRA-02), manual data path with a single operator (INFRA-01), root container (SEC-08). Docker build not executed in this review. |
| 9. Overall production readiness | **Not ready** | Blocked by security/PII items and missing operational envelope. The domain core is sound and does not need rewriting. |

---

## E. Prioritized Roadmap

### P0 — Critical (do before anything else)

**P0-1 Contain PII in the repository (SEC-01)**
- Expected outcome: no raw PII in the working tree or reachable history; recurrence prevented.
- Effort: M. Dependencies: owner + privacy/legal sign-off; coordinated force-push (explicit approval required).
- Acceptance criteria: a phone-pattern scan of all history returns nothing; notebooks committed without outputs; CI step fails on notebooks with outputs.
- Implementation risks: history rewrite invalidates every clone, open branch and tag; collaborators must re-clone. Clones and forks that already exist cannot be recalled.

**P0-2 Restrict network exposure until auth exists (SEC-02 interim)**
- Expected outcome: the container is reachable only by intended users.
- Effort: S. Dependencies: none.
- Acceptance criteria: port bound to `127.0.0.1` or firewalled to an allow-list; documented.
- Risks: may break existing LAN demo access — agree with users first.

### P1 — Production blockers

**P1-1 Authentication via SSO (SEC-02)** — Effort M; depends on IdP (G-2). Acceptance: every `/api/v1/*` route returns 401 without a valid identity; `/health` stays open; e2e uses a test identity. Risk: CORS/credentials changes in the SPA.

**P1-2 Remove raw PII from snapshots; keyed hashing (SEC-03, SEC-04)** — Effort M; depends on secret distribution. Acceptance: `answers` holds no raw contact/phone values; parity tests still pass; KPI results identical to before on the same data. Risk: changing the hash invalidates any previously exported hashed keys — confirm none are relied upon.

**P1-3 Decide and enforce sanitization semantics per source (ARCH-01)** — Effort S (enforce/warn) to L (physical tables). Acceptance: either VIEW mode is disabled in production config or the API rejects/flags tiers it cannot apply; UI shows it. Risk: users currently relying on VIEW numbers will see a change — communicate.

**P1-4 Fix SPA path containment (SEC-05)** — Effort S. Acceptance: regression test with encoded `..` returns index or 404, never a file outside `web/dist`. Risk: minimal.

**P1-5 Logging, request IDs, readiness endpoint (OBS-01, OBS-03, DATA-04)** — Effort S–M. Acceptance: structured logs with request ID, route, status, duration; `/ready` reports snapshot age/rows and returns non-200 when missing; Docker healthcheck uses it. Risk: logging must not include request bodies (PII).

**P1-6 Reproducible build and rollback (INFRA-02, SEC-08)** — Effort M. Acceptance: CI builds and pushes an image tagged by git tag/SHA, runs as non-root, smoke-tests `/health` and one synthetic `/process`; rollback documented as redeploying the previous tag. Risk: registry access/credentials.

**P1-7 Scheduled, validated snapshot refresh (INFRA-01, DATA-01)** — Effort M. Acceptance: refresh runs on a schedule under a service account, writes to temp, validates row counts against thresholds, swaps atomically, keeps the previous file, and alerts on failure. Risk: needs a host with permanent SQL Server access (G-3).

**P1-8 Bound request sizes (SEC-07)** — Effort S. Acceptance: oversized payloads return 413/422; UI maximum still works. Risk: picking limits below a real use case.

### P2 — High-value improvements

- **P2-1 Central typed settings, validated at startup (ARCH-03).** Effort M. Acceptance: one settings module; app fails fast at boot on invalid config; effective config logged without secrets. Risk: subtle default changes — keep current defaults.
- **P2-2 Engine lifecycle + timeouts (ARCH-04, PERF-03).** Effort S–M. Acceptance: one engine per URL per process, disposed in lifespan; query timeout configured; a slow query returns 503 within the limit. Risk: timeout too low for legitimate heavy queries.
- **P2-3 Fix Query A/B boundary-month mismatch (ARCH-02).** Effort S–M. Acceptance: new test with mid-month range shows Query A and Query B over the same population. Risk: changes numbers for custom ranges — expected, communicate.
- **P2-4 Remove hardcoded dates (ARCH-09).** Effort S. Acceptance: "YTD" derives from the current year; kitchen window from config. Risk: minimal.
- **P2-5 Frontend dependency remediation (SEC-06).** Effort S–M. Acceptance: `npm audit --omit=dev` has no critical findings. Risk: Plotly major upgrade may change chart rendering — covered by existing chart tests partly; visual check needed.
- **P2-6 Test gaps (TEST-02).** Effort M. Acceptance: coverage reported in CI; synthetic SQLite fixture enables `source=db` e2e; security regression tests exist. Risk: flaky e2e if fixtures drift.
- **P2-7 Gate tracemalloc behind a debug flag (PERF-01).** Effort S. Acceptance: `peak_memory_mb` absent or null unless enabled; latency unchanged or better. Risk: frontend may expect the field — keep it optional.

### P3 — Medium-priority improvements

- **P3-1 Extract shared direction-aware planner allocator (CODE-01).** Effort M. Acceptance: both planner test suites pass unchanged. Risk: small numeric differences — compare outputs on fixed fixtures before/after.
- **P3-2 Split `backend/main.py` into routers (CODE-02).** Effort M. Acceptance: OpenAPI schema identical before/after (diff `/openapi.json`). Risk: route order — the `/sample/db` before `/sample/{preset}` ordering must be kept.
- **P3-3 Align tier module names with pipeline steps (ARCH-05).** Effort M. Acceptance: old imports still work via aliases; tests green. Risk: notebooks importing old names.
- **P3-4 Hash once per pipeline run (CODE-03).** Effort S. Acceptance: identical KPIs on all fixtures. Risk: low.
- **P3-5 Lazy-load research code; move sklearn/openpyxl to an extra (ARCH-06).** Effort S. Acceptance: `import backend.main` does not import sklearn; image smaller. Risk: scripts need `--extra research`.
- **P3-6 Python lint/type checks in CI (CODE-04).** Effort S. Requires approval for dev-only tools.
- **P3-7 Server-side telemetry/metrics and error tracking (OBS-02).** Effort M. Depends on platform (G-5).

### P4 — Optional cleanup

- Remove stale `pyproject.toml` package paths and `backend/requirements.txt`; single-source version (ARCH-07). S.
- Remove legacy `api/` app after confirming no consumers (ARCH-08). S.
- Public data-access helpers instead of `_private` imports (ARCH-10). S–M.
- Snapshot `schema_version` (DATA-02). S.
- Repository hygiene: lock file, merged branches, root docs, stale CI branch filters, Node version alignment (INFRA-03, INFRA-04). S.
- Fix lint warnings and TestClient deprecation (CODE-05, TEST-03). S.
- Optional result caching keyed on snapshot `loaded_at` (PERF-04). S–M.

---

## F. Recommended Execution Strategy

Principles: keep the domain core as is; change the envelope around it; each step is independently shippable and verified by the existing test suites plus a new targeted test.

1. **Week 0 — Containment (P0).** Restrict exposure; decide on and perform the PII history purge; add a notebook-output CI check. No application behaviour changes.
2. **Safety net before changes.** Capture golden outputs: `/openapi.json`, and `/process` + `/plans` + `/plans-tts` responses for each synthetic preset and for a small synthetic SQLite snapshot fixture. Every later refactor must reproduce them byte-for-byte (except timestamps/telemetry).
3. **Security envelope (P1-1, P1-4, P1-8, SEC-08).** Path containment fix and request limits first (small, testable), then SSO. Run full CI + e2e after each.
4. **Data path (P1-2, P1-3, P1-7).** Get the business decision on ARCH-01, then move hashing into the refresh job and make refresh scheduled/atomic/validated. Verify KPI parity against golden outputs.
5. **Operability (P1-5, P1-6).** Logging + readiness, then CI image build/publish and documented rollback. Do one rehearsal: deploy tag N, roll back to N-1.
6. **Hardening (P2).** Central settings and engine lifecycle together (they touch the same code), then the boundary-month fix (expect intentional number changes — announce), then dependency upgrades, then test gaps.
7. **Maintainability (P3/P4)** opportunistically, each guarded by golden outputs; never mixed with behaviour changes in the same PR.

What not to do: no rewrite of the pipeline or planners, no new application database unless G-4 requires it, no framework change on the frontend.

---

## G. Open Questions

1. **ARCH-01:** Which numbers are authoritative in production — VIEW (blacklist only) or snapshot/physical tables (all tiers)? Should VIEW mode be allowed in production at all?
2. **Access:** Who are the users, how many, and which identity provider should gate access? Do any users need restricted views (e.g. per region/store)?
3. **Data path:** Will the DBA deliver the physical tables from SPEC §5.4? If not, which host and service account will run scheduled refreshes, and how fresh must data be (daily? hourly)?
4. **Persistence/audit:** Must plans, configurations, or published KPI results be stored and auditable, or is session-only state acceptable?
5. **Hosting and platform:** Where will production run (on-prem Docker host, Kubernetes, cloud)? Which logging/monitoring/error-tracking platform is standard?
6. **Legacy surfaces:** Does anything still use `api/main.py` (port 8000) or the Angular PoC tag?
7. **Repository visibility:** Is the GitHub repository private? Who has access, and have forks or external clones been made? (Determines the scope of SEC-01 response.)
8. **Compliance:** Which privacy regime applies to survey contact data (e.g. Israeli Privacy Protection Law / GDPR), and what retention period applies to the local snapshot files?
9. **Kitchen TTS:** Is the `/tts-kitchen/before-after` endpoint meant to be live in production, given the UI shows it as "coming soon" and its date window is fixed?
10. **Python version:** Project rules mention Python 3.13+, the project pins 3.12. Which is the target?
11. **Exports:** Are hashed entity keys exported anywhere today (e.g. `scripts/export_always5_entities.py`)? This affects whether changing the hash scheme (P1-2) breaks downstream consumers.
