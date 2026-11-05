# REPORT-A001 — Architecture: Coupling, Cohesion & Production Viability

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A001](../specs/SPEC-A001-architecture-coupling.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review: code, `git`, filesystem. Tests, Docker and Playwright were **not** run. |
| **Status** | Report ready (G-1 decision pending) |

> **Method note.** The Cursor search index was stale and listed files deleted in commit `3df409e`
> (`backend/tts_service.py`, `src/tts_guard/*`, `src/tts_order_bump/*`). Every finding below was
> checked against `git` / `Test-Path`, not against search results alone.

---

## 1. Component map (as-is)

```text
web/ (React SPA) --fetch--> web/src/api/client.ts (single fetch, Zod parse)
                                |
backend/main.py  (create_app: all routes + orchestration, 497 lines)
 |- /process ---> queries.py (Query A + B) <- db_sample._process_engine <- snapshot.get_sanitization_source (env)
 |                 '-> service.run_pipeline_pushdown / run_pipeline  (738 lines, pandas)
 |- /plans, /plans-tts ---> src/planner/{five_percent,tts}.py  (pure logic)
 |- /tts-kpi/ap ---> backend/tts_kpi_ap.py (IO: snapshot|sql|dreamfactory) ---> src/planner/tts_kpi_ap.py (pure mapping)
 '- /tts-kitchen/before-after ---> tts_kitchen_{service,queries}.py ---> src/tts_kitchen/{fold,report}.py
Sources: SQLite snapshot (:ro mount) | MSSQL VIEW | AP/DreamFactory | synthetic
```

Module boundaries:

- `src/` — pure domain: `fraud_guard`, `planner`, `tts_kitchen`, `schemas`.
- `backend/` — HTTP and IO.
- `db/` — `config.py`, `connection.py`.
- `api/` — legacy app with health only.

## 2. Seams to keep (do not touch)

- `src/` is pure, with no IO.
- TTS KPI uses a good "source = strategy" seam: `TTS_KPI_SOURCE` selects the transport (`backend/tts_kpi_ap.py:44-63`); row mapping is separate in `src/planner/tts_kpi_ap.py`.
- The frontend has one `fetch(` in `web/src/api/client.ts:53`, and responses are validated with Zod (`schema.parse`).
- No shared mutable state: no `lru_cache` or module-level caches in `backend/`; only `db.config.get_settings` is cached.

## 3. Architecture risk registry

Gate **G-1** (see §6): if production is snapshot-only, VIEW-path risks (A-01, A-03) are partly neutralised.

| ID | Finding | Type | Evidence | Class | Sev | Effort | Minimal fix |
|----|---------|------|----------|-------|-----|--------|-------------|
| **A-01** | **"Sanitized 5%" depends on the data source.** VIEW applies blacklist only; snapshot applies tiers 1–3. The code default is `view` (`snapshot.py:85`), while Docker overrides to `snapshot` (`Dockerfile:30`, `docker-compose.yml:12`). Running outside Docker silently uses VIEW. | compromise | `queries.py:276-278`, `service.py:475,510,521`; `echo_config` reports tiers as enabled | **Release blocker** | High | S | Fix G-1 and add a guard: on `view` with tier 2/3 enabled return 422 or an explicit flag |
| **A-02** | **Query A and Query B cover different periods on snapshot.** Query A aggregates by month (`queries.py:115-137`: "no AnswerTime… month granularity"); Query B filters by date. Preset `ytd_2026` is safe (Jan 1 to today); a custom range starting mid-month diverges. | data coupling | `period.ts:45-46`, `queries.py:119-123` | **Release blocker** (custom range is a shipped feature) | High | S–M | On snapshot, normalise bounds to months or return 422; add a mid-month parity test |
| **A-03** | **Engine created per request and never disposed.** `/process` calls `_process_engine()` twice (`queries.py:250` and `:484`) = two engines per request. No `dispose()` in the sanitization path. On VIEW that is a new pool and login per request; no timeouts, so a slow query holds a threadpool worker. | load | `db/connection.py:6-12`, `db_sample.py:240-260` | **Blocker\*** | Med–High | S–M | One engine per URL, dispose in lifespan, add a timeout. \*Only if VIEW goes to production |
| **A-04** | **Source selection repeated in 4 places.** `main.py:309-312` re-derives `q_mode` from env instead of from the engine already chosen. Others: `db_sample._process_engine`, `load_db_sample_meta_from_settings:272`, `queries.process_source_meta_extra:498`. | tight coupling to global env | places listed | **Defer** (but part of refactor step 2) | Med | S | One `resolve_process_source()` returning `(engine, dialect, query_b_mode)` |
| **A-05** | **Config sprawl.** `db.config.Settings` (`lru_cache`) plus raw `os.environ` in 5 modules. `Settings.cors_origins` is unused (`db/config.py:32`); `main.py` reads CORS itself and defaults diverge (`5173,4201` vs `4200`). `tts_kpi_snapshot.py:227` mutates `os.environ`. `get_settings()` requires `DATABASE_URL` even when only `tts_view` is needed (`tts_kitchen_queries.py:181`). | cohesion | grep `os.environ`, `db/config.py` | **Defer** | Med | M | Typed settings with startup validation, after launch |
| **A-06** | **Twin duplication.** `planner/five_percent.py` and `tts.py` share about 138 of 183 lines. `PlannerPage.tsx` and `TtsPlannerPage.tsx` (1266 / 1204 lines) share about 679 lines. `main.py:370-408` and `:419-457` duplicate plan→response mapping. | duplication | rough set-based line comparison | **Defer** | Med | M–L | Later extract a direction-aware allocator under existing tests |
| **A-07** | **Orchestration inside the HTTP handler.** `process()` (`main.py:263-360`) builds Query A → B → pipeline → meta itself; not testable without HTTP. | cohesion | `main.py:263-360` | **Defer** | Med | M | Move `run_process_db()` into `backend/service.py` |
| **A-08** | **Layering: private imports and cycles.** `snapshot.py:19` imports from `db_sample`, which lazily imports `snapshot` (`:242,256,265`). `queries.py` imports `_period_params` and `_process_engine`; `scripts/` import `_engine_from_settings`. | coupling | places listed | **Defer** | Low–Med | S–M | After A-04, extract a shared source module |
| **A-09** | **Naming and package drift.** `tier1.py` holds steps 1–3, `tier2.py` holds step 4 (`service.py:93`), `tier3.py` is IsolationForest (research). `pyproject.toml` lists non-existent `src/tts_guard` and `src/tts_order_bump`. Imports of `fraud_guard` / `planner` rely on `PYTHONPATH=/app:/app/src` (`Dockerfile:30`). Effect of the stale paths on wheel build was not verified. | drift | `pyproject.toml:32-43`, `Test-Path` = False | **Defer** | Low–Med | S | Remove stale paths from `pyproject.toml` |
| **A-10** | **Research code loaded into the API process.** `fraud_guard/__init__.py:13` imports `tier3`, which imports `sklearn` at module level (`tier3.py:17-18`). Any `fraud_guard.*` import loads sklearn, although SPEC forbids ML in the API. | compromise | lines listed | **Defer** | Low | S | Drop `tier3` from `__init__` or import lazily |
| **A-11** | **Hardcoded dates.** Kitchen window `2026-09-01..2026-10-20` (`tts_kitchen_queries.py:24-25`). `DEFAULT_FROM_DATE = 2025-01-01` (`db_sample.py:33`). Preset `ytd_2026` stops meaning "YTD" after 2027-01-01. Kitchen is "coming soon" in the UI but the endpoint is live. | compromise | places listed | **Defer** | Low–Med | S | Move the window to config. Deadline for `ytd_2026`: 2027-01-01 |
| **A-12** | **Load ceiling: single uvicorn process, sync handlers, pandas under the GIL.** Throughput is about one core. Inline `rows` up to 500,000 (`schemas.py:100`). | load | `Dockerfile` CMD, `schemas.py:100` | **Defer** for a small internal audience (details in A007) | Med | S | Document: vertical scaling only |

## 4. Minimal refactor for internal launch

1. **Decision G-1** (no code): production = snapshot only; VIEW = dev only. This removes A-01 and A-03 as blockers.
2. **Single `resolve_process_source()`** (A-04). `main.py` takes engine, dialect and `query_b_mode` from one place instead of re-reading env. This also cuts engines per request from two to one. Effort S.
3. **Guard on tiers under VIEW** (A-01): 422 or a flag in `meta`. The backend already returns `meta.query_b_mode` and `meta.reconciliation` (`service.py:586-587`), but the UI does not read them (no matches in `web/src`). Effort S.
4. **Snapshot period normalisation** (A-02): month bounds or 422, plus a parity test. Effort S–M.
5. **Engine lifecycle and timeouts** (A-03). Needed only if VIEW stays in production. Effort S–M.

Everything else stays out of the launch minimum.

## 5. Deliberately deferred, and why that is safe

- **A-05 … A-12** do not break KPI correctness. The Docker image sets everything explicitly, the domain is test-covered (129 backend and 290 frontend tests per the assessment), and the audience is small.
- Record these limits in the runbook: vertical scaling only; kitchen disabled in the UI; after 2027-01-01 preset `ytd_2026` spans more than one year.

## 6. Open business decisions

- **G-1:** which source is authoritative in production, and is VIEW needed at all?
- Are custom ranges starting mid-month acceptable? If yes, their KPI must be computed from `answers`, not from pre-aggregated `store_month`.
- Should the UI show "tiers 2–3 not applied" under VIEW?

## 7. Re-verification of assessment ARCH-*

| ID | Verdict | Note |
|----|---------|------|
| ARCH-01 | **Confirmed, narrowed** | Backend discloses the mode in `meta`; the UI does not show it; `echo_config` is misleading |
| ARCH-02 | **Confirmed, narrowed** | Presets are safe; risk is limited to custom ranges |
| ARCH-03 | **Confirmed** | Plus unused `Settings.cors_origins` |
| ARCH-04 | **Confirmed** | Two engines per request, no dispose |
| ARCH-05 | **Confirmed** | `tier1.py` holds steps 1–3, `tier2.py` holds step 4 |
| ARCH-06 | **Confirmed** | `fraud_guard/__init__.py:13` pulls in sklearn |
| ARCH-07 | **Confirmed** | Two non-existent directories in `pyproject.toml` |
| ARCH-08 | **Not re-verified** | Legacy `api/` contains only health; no runtime impact |
| ARCH-09 | **Confirmed** | See A-11 |

## 8. Limitations

- `docs/**` and `web/src/**` were read partially.
- Twin-duplication figures are a rough set-based line comparison.
- No load measurements.
- No tests, Docker or Playwright were executed.

---

## Acceptance check (SPEC-A001 §7)

- [x] REPORT-A001 created at the path from the spec.
- [x] Every blocker has evidence and a minimal fix.
- [x] Coupling, duplication and compromises covered (not security only).
- [x] ARCH-* re-verified (ARCH-08 explicitly marked not re-verified).
- [x] Refactor backlog limited to what internal launch needs.
- [x] README index updated.
