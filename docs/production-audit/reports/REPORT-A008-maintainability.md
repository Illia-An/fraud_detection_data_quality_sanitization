# REPORT-A008 — Maintainability: Tech Debt, Smells & 6-Month Supportability

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A008](../specs/SPEC-A008-maintainability.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review: file sizes and function lengths, line-level twin comparison, `pyproject.toml` / CI config, docs vs code, `eslint .` (read-only). `pytest` / `tsc` / Docker **not run**. Similarity numbers are crude (share of trimmed lines of A also present in B), directional only. |
| **Status** | Report ready (product-lock timing / dev-tool approval / legacy `api/` consumers open) |

> **Method note.** The Cursor search index is stale (lists deleted files such as
> `src/tts_guard/pipeline.py`, `tests/test_tts_order_bump_synthetic.py`). Every path below
> was checked with `Test-Path` / `git ls-files`.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (ARCH-01 dual path),
> [REPORT-A003](./REPORT-A003-security-hardening.md) (not duplicated here),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (tests are the safety net for every
> refactor below), [REPORT-A007](./REPORT-A007-performance-scalability.md) (P-02 `service.py`
> hot spots).

---

## 1. Supportability summary (6-month outlook)

**Score: 3 / 5 — Fair.** Workable for the current author(s). Expensive for a newcomer or a
requirement change that touches planners, TTS bounds, or data sources.

**Strengths (keep):**

- Clean split of pure domain (`src/fraud_guard`, `src/planner`, `src/tts_kitchen`) from HTTP
  (`backend/`).
- Pydantic contracts with a legacy-key migration (`src/schemas/pipeline.py:13-30`).
- Good docstrings in the domain core.
- A large test suite.
- A pushdown design with a reconciliation contract.

**Weaknesses:**

- Copy-paste “twins” on four layers: planner math, planner API mapping, snapshot modules,
  planner pages.
- God-components and a god-closure: `create_app` (401 lines), two ~1,060-line React components.
- No Python lint or type checking in CI.
- Naming drift (tier files ≠ pipeline steps).
- Stale docs and manifests.
- Hardcoded business dates and TTS bounds with no single source.

**Verdict for release:** nothing here makes a required release change unsafe or untestable,
and no dual-path drift gives wrong results under likely config. **No Release blocker** for
maintainability. Several items are **“do before the named feature change”** (marked
`Defer*` below).

---

## 2. “Fragile / rewrite-soon” modules (ranked)

| # | Module | Why the first requirement change is expensive | Urgency |
|---|--------|-----------------------------------------------|---------|
| 1 | `web/src/pages/PlannerPage.tsx` (1,221) + `TtsPlannerPage.tsx` (1,163) | One ~1,060-line component each, 17–18 `useState`, 4 `useEffect`. About 70% shared lines; 3 identical `exhaustive-deps` warnings (`setControlsOpen`). Any planner UX change is two edits and drifts. | **Extract before planner feature work** |
| 2 | TTS bounds / defaults spread over `src/planner/tts.py` (ceiling 30, step 0.25), `backend/tts_plan_schemas.py:17-18,30,40` (floor/ceiling/target 3.5), `TtsPlannerPage.tsx:70-71,155` — docstring says “until the product lock replaces them” | The product lock is pending → most likely first change. Touches Python, Pydantic, and React in lockstep. | **Centralize before the product lock lands** |
| 3 | `backend/main.py::create_app` (`:97`, 401 lines; `/process` handler `:263-369`, 107 lines) | Every route is a closure. `/process` mixes orchestration, timing, and meta assembly. Plan→response mapping is duplicated (`create_plan` 49 lines / `create_tts_plan` 51 lines). A005 logging middleware, A007 guards, and any new endpoint all land here. | **Split into routers before A005/A007 fixes** |
| 4 | `backend/service.py` (645) — `run_pipeline` (144) and `run_pipeline_pushdown` (150) | Two parallel tier orchestrations (inline vs pushdown, ARCH-01). A tier-rule change must be mirrored. `apply_fn` is untyped; behaviour is coupled to the `query_b_mode` string literal. | Extract a shared tier-step table; **before changing tier rules** |
| 5 | Data-access cluster: `db_sample.py`, `queries.py`, `snapshot.py`, `tts_kpi_snapshot.py` | Private helpers cross-imported (`_period_params`, `_process_engine`, `_engine_from_settings` used by `queries.py` and 3 scripts). Function-local imports dodge cycles (`db_sample.py:256,265`, `queries.py:500`). Snapshot twins duplicate engine/path/meta logic. A new source or refresh change touches many files. | Extract a public `data_access` module; **before adding a source** |
| 6 | `src/fraud_guard` naming + PII hashing | `tier1.py` implements pipeline tiers 1–3, `tier2.py` = tier 4, `tier3.py` is an unused IsolationForest (ARCH-05). `__init__` imports sklearn (ARCH-06). `ensure_pii_hashed` runs 4× per pushdown run (§5). High risk of wiring the wrong rule. | Aliases + docs; **before onboarding a new dev** |
| 7 | `scripts/export_tier_manager_doc_he.py` (904 lines; four builders of 141–223 lines) | Hand-built docx XML in he/ru copies. Not on the release path. | **Can live** until the doc generator is touched |

---

## 3. Tech debt backlog

`Defer*` = Defer, but do before the feature change named in “Suggested next step”.

| ID | Item | Smell type | Evidence | Support risk (6mo) | Class | Severity | Effort | Suggested next step |
|----|------|------------|----------|--------------------|-------|----------|--------|---------------------|
| **M-01** | Planner pages are parallel ~1,060-line components | Duplication / god-component | `PlannerPage.tsx:157`, `TtsPlannerPage.tsx:127`; ~70% shared lines; both export one component | High | **Defer\*** | Med | M–L | Extract shared planner shell + scenario hook; first on TTS product lock |
| **M-02** | TTS bounds/defaults in ≥3 layers | Magic numbers / scattered config | `tts.py` (ceiling 30, step 0.25); `tts_plan_schemas.py:17-18,30,40`; `TtsPlannerPage.tsx:70-71,155` | High | **Defer\*** | Med | S | One backend source exposed via API/meta; FE reads it |
| **M-03** | `create_app` god-closure + duplicated plan mapping | God-module | `main.py:97-497`, `:370-455` | High | **Defer\*** | Med | M | `APIRouter` per domain, no behaviour change; diff `/openapi.json`; keep `/sample/db` before `/sample/{preset}` |
| **M-04** | Planner math twins | Duplication | `five_percent.py` vs `tts.py` (~70% shared lines). `tts.py` already imports helpers, but the allocation core is mirrored. | Med–High | **Defer\*** | Med | M | Direction-aware allocator behind existing planner tests |
| **M-05** | Validation drift between twins | Drift | `tts.py` rejects `floor >= ceiling`; `five_percent.py` does not | Med | **Defer** | Low–Med | S | Align during M-04 |
| **M-06** | `service.py` dual pipelines | Duplication / complexity | `service.py:445-595`, `:595-739` | Med–High | **Defer\*** | Med | M | Shared tier-step table; type `apply_fn` |
| **M-07** | Snapshot module twins | Duplication | `snapshot.py` vs `tts_kpi_snapshot.py` (path, engine, meta, schema init) | Med | **Defer** | Low–Med | M | Shared snapshot base; see A002 refresh redesign |
| **M-08** | Private cross-module helpers + local imports | Coupling | `queries.py:13-19`; `db_sample.py:256,265`; `scripts/refresh_q10012_snapshot.py:24-28` | Med | **Defer** | Low–Med | S–M | Public `data_access` module |
| **M-09** | Tier naming drift | Naming | `tier1.py` = tiers 1–3, `tier2.py` = tier 4, `tier3.py` unused (ARCH-05) | Med–High | **Defer** | Med | M | Rename/re-export; old paths as aliases |
| **M-10** | PII re-hashed per tier | Latent trap | `tier1.py:204-213,224,238,252,266`; `pii.py:33-36`; `db_sample.py:79-84` | Med | **Defer** | Low–Med | S | Hash once at entry; correct the docstring first |
| **M-11** | Research deps loaded in API | Packaging | `fraud_guard/__init__.py` imports `tier3` → sklearn (ARCH-06) | Low–Med | **Defer** | Low–Med | S | Lazy import; `research` extra |
| **M-12** | Packaging / manifest drift | Config drift | `pyproject.toml:37,39` (`tts_guard`, `tts_order_bump`); `backend/requirements.txt`; version `0.1.0` in 3 places vs tag `v1.30.0` | Med | **Defer** | Low–Med | S | Remove stale entries; single-source version (shared with A005 `/health`) |
| **M-13** | Legacy `api/` app | Dead code | `api/main.py`, `api/routers/health.py`, `README.md:60-69`, `tests/test_health.py` | Low–Med | **Defer** | Low | S | Remove after consumer check (O-5) |
| **M-14** | No Python lint / type checks | Tooling gap | `pyproject.toml` has no ruff/mypy; `ci.yml:36-37` runs pytest only | Med | **Defer** | Low–Med | S | Add ruff + type checker as dev tools (needs approval) |
| **M-15** | Frontend lint warnings; CI does not gate | Hygiene | `eslint .`: 0 errors / 9 warnings; `ci.yml:59` has no `--max-warnings` | Low | **Defer** | Low | S | Fix, then `--max-warnings 0` |
| **M-16** | Hardcoded business dates (duplicated BE+FE) | Magic values | `tts_kitchen_queries.py:24-25` and `web/src/schemas/ttsKitchen.ts:7-8`; `ytd_2026` preset; `DEFAULT_FROM_DATE` (assessment ARCH-09) | Med | **Defer\*** | Med | S | Derive from config / current date; one source for kitchen window |
| **M-17** | Docs drift (see §5) | Docs | multiple | Med | **Defer** | Low–Med | S | One docs pass after M-03 / M-09 |
| **M-18** | `SanitizationResponse` loose typing | Typing | `src/schemas/pipeline.py:71-73,75` (`dict[str, Any]` for series and `meta`) | Med | **Defer** | Low–Med | M | Typed models for stable keys; `meta` stays open |
| **M-19** | Large one-off script | Size | `export_tier_manager_doc_he.py` (904 lines) | Low | **Defer** | Low | M | Leave unless touched |
| **M-20** | Mojibake in text files | Encoding | `pyproject.toml` description, `TASKS.md` headings | Low | **Defer** | Low | S | Re-save as UTF-8 |

---

## 4. Typing & static analysis gaps

- **Python:** no ruff / flake8 / mypy / pyright config; the `dev` extra has only pytest,
  jupyter, ipykernel, matplotlib. CI runs pytest only (`ci.yml:36-37`).
- **Typing holes:** `apply_fn` untyped in `service.py:198`; `# type: ignore[arg-type]` at
  `service.py:108` (Literal `step_name` fed a `str`); two more in `tests/test_contracts.py`
  and one in `scripts/export_store_research_excel.py:464`. `dict[str, Any]` for
  `high_store_months`, `store_impact_series`, `meta` (M-18).
- **Contract parity** is manual (`backend/ARCHITECTURE.md` “MUST match 1:1” between Pydantic
  and Zod). No automated Python↔Zod / OpenAPI check found (**Potential**; one `openapi`
  reference in `test_process_api.py:118-120` not reviewed in depth).
- **Frontend:** `tsc -b` runs in `build`. ESLint: 0 errors, **9 warnings** —
  5 `react-refresh/only-export-components` (`PipelineStepsTable.tsx:127,161`,
  `EvaluationLegend.tsx:486`, `HeroSimulationChart.tsx:68`), 4 `exhaustive-deps`
  (`setControlsOpen` in `PlannerPage.tsx:215`, `TtsPlannerPage.tsx:208`,
  `SanitizationPage.tsx:89`; `StoreAuditDrawer.tsx:177`), 1 unused directive
  (`analytics.ts:21`). CI does not fail on warnings.

---

## 5. Docs drift

| # | Doc | Drift | Evidence |
|---|-----|-------|----------|
| 1 | `backend/ARCHITECTURE.md` | Says the UI runs “Tier 1 + Tier 2 only” and logic is `tier{1,2,3}.py`. Port **8001**, Docker uses **8000**. Lists 4 endpoints; missing `/plans`, `/plans-tts`, `/tts-kpi/ap`, `/sample/tts-kpi/*`, `/tts-kitchen/before-after`. Security note says read-only `SELECT` on one VIEW only; snapshots and TTS/AP sources now exist. | file; last commit 2026-09-22 |
| 2 | `ensure_pii_hashed` docstring | “call once at pipeline entry” vs 4 callers via `_prepare_tier_frame`. `tier1.py:84` also says “Call `ensure_pii_hashed` first”. | `pii.py:33-36`, `tier1.py:84,209` |
| 3 | `README.md:60-69` | Presents “legacy API (port 8000)” via `api.main`. | README; `api/main.py` |
| 4 | `pyproject.toml` / `requirements.txt` | Stale wheel packages; incomplete requirements; version in 3 files vs release tags. | `pyproject.toml:37,39` |
| 5 | `SPEC-tts.md:220` + `docs/tts_full_view_for_proj/*Order_Bump*` | References `tts_guard` and an Order Bump feature removed in “product trim” (**Potential**: only one line of `SPEC-tts.md` reviewed). | `git ls-files` |
| 6 | `TASKS.md` | Last touched 2026-09-28; ends at TASK-15. No entries for later planner, TTS, and kitchen work (**Potential**). | file |
| 7 | Python version | `.python-version`, CI, and Dockerfile = 3.12; workspace rules say 3.13+ idioms; local shell is 3.13.3 (**Potential**). | `.python-version`, `ci.yml:28` |

---

## 6. Re-verification of assessment findings

| Finding | Verdict | Note |
|---------|---------|------|
| CODE-01 | **Confirmed, now quantified** | Planners ~70%, pages ~70%, plan schemas ~48%, snapshots ~42%. Frontend upgraded from Medium to High confidence. |
| CODE-02 | **Confirmed** | `create_app` 401 lines; `/process` 107; `run_*` 144/150; both pages one ~1,060-line component. |
| CODE-03 | **Confirmed** | Up to 4 hashes on pushdown (`redact_row` + 3 tier steps). No wrong result found: entity keys are not compared across steps. Docstring contradiction stands. |
| CODE-04 | **Confirmed** | No Python lint/type tooling in config or CI. |
| CODE-05 | **Confirmed** | 9 warnings re-run today, 0 errors. |
| ARCH-05 | **Confirmed** | File ≠ step naming; `PipelineConfig` docstring uses the four-step names. |
| ARCH-07 | **Confirmed** | Stale hatch packages, `requirements.txt`, version in 3 places. |
| ARCH-08 | **Confirmed** | Second app still in README and tests. |

---

## 7. What **not** to rewrite (preserve good seams)

- Pure tier rule functions and `Tier1Config` (`src/fraud_guard/tier1.py`) — fix naming and
  hashing, don’t rewrite the rules.
- `PipelineConfig` + legacy migration (`src/schemas/pipeline.py`).
- Pushdown reconciliation concept (Query A aggregates minus Query B candidate drops).
- Planner math core: extract the allocator behind existing tests, don’t redesign.
- `src/tts_kitchen/fold.py` / `report.py` (small, pure).
- Zod mirror of the Pydantic contract (add a parity check, keep the approach).
- The test suite and the route-order guard (`/sample/db` before `/sample/{preset}`).

---

## 8. Minimal sequence before feature work (backlog only — no code until Approved)

1. **M-14 + M-15** (S): lint/type gates make every later refactor safer. Needs dev-tool approval.
2. **M-03** (M): split `create_app` into routers (also unblocks A005/A007 changes).
3. **M-02 + M-16** (S): centralize TTS bounds and kitchen dates before the product lock.
4. **M-04 → M-01**: planner allocator, then shared planner shell.
5. **M-09 / M-10 / M-12 / M-13 / M-17**: naming, hashing, manifests, legacy app, docs pass.

---

## 9. Open questions

| ID | Question | Affects |
|----|----------|---------|
| **O-1** | When is the TTS product lock expected? | Urgency of M-01 / M-02 |
| **O-2** | Team size / bus factor for the next 6 months? | Supportability score |
| **O-3** | Python target: stay on 3.12 or move to 3.13 (Dockerfile, CI, `.python-version`)? | Tooling baseline |
| **O-4** | Approval for ruff and a type checker as dev dependencies? | M-14 |
| **O-5** | Any consumers of the legacy `api/` app (G-6)? | M-13 |
| **O-6** | Is `export_tier_manager_doc_he.py` still in use? | M-19 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Initial REPORT-A008 from SPEC execution (EN). |
