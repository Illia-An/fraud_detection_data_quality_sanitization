# Production refactor plan

Phased roadmap based on the production audit (`docs/production-audit/reports/REPORT-A001` … `REPORT-A011`).  
Do waves in order. Each wave = its own branch + green CI; tag when it closes a go-live gate.

## Principles

1. Correct KPI and intact snapshots first; security/ops next; code comfort last.
2. Write tests with each fix (A004), not afterward.
3. Keep seams: pure `src/`, single FE `fetch` + Zod, TTS KPI strategy adapters.
4. Prefer small PRs over “big bang” refactors.

---

## Wave 0 — Decisions (little/no code)

| Decision | Why |
|----------|-----|
| **G-1** production = snapshot-only; VIEW = dev | Removes a class of VIEW blockers |
| Freshness SLA | Threshold for `/ready` |
| Network lock until auth | Closes S-02 for launch |
| Snapshot PII: hash-at-refresh **or** disk-encryption waiver | S-04 |
| Alert channel | A005 |
| Registry / deploy host | A006 |
| RPO/RTO for snapshot copies | DR |

**Done when:** written in the runbook / open decisions closed.

---

## Wave 1 — Source of truth & KPI correctness

**Goal:** one meaning of “Sanitized 5%”; no silent VIEW path.

| # | Work | Audit IDs |
|---|------|-----------|
| 1.1 | `resolve_process_source()` → `(engine, dialect, query_b_mode)` | A-04 |
| 1.2 | Guard: VIEW + tiers 2/3 → 422 or explicit flag; UI reads meta | A-01, ARCH-01 |
| 1.3 | Snapshot mid-month: month bounds or 422 + parity test | A-02, T-02 |
| 1.4 | Docker/env: prod default = snapshot; outside Docker → explicit warning | G-1 |
| 1.5 | VIEW-guard test | T-06 |

**Done when:** mid-month custom range and VIEW+tiers cannot silently wrong the KPI; one engine resolution path per request.

**Suggested branch:** `feat/prod-source-truth`

---

## Wave 2 — Snapshot integrity

**Goal:** refresh cannot silently destroy a good snapshot.

| # | Work | Audit IDs |
|---|------|-----------|
| 2.1 | `schema_version` in meta + check in `require_*` | D-05 |
| 2.2 | Refresh → `*.tmp` → gates → meta inside tmp → `os.replace` | D-01, D-03 |
| 2.3 | Gates: row floor, vs previous, `store_month` ↔ answers | D-04, D-08, D-09 |
| 2.4 | Compose: mount `data/` directory, not single files | D-02 |
| 2.5 | Keep `.prev` / N copies | INFRA-05, CD-04 |
| 2.6 | Tests: refresh crash / empty / schema mismatch | D-13, T-01, T-03 |

**Done when:** empty pull does not replace prod; mismatch → 503; atomic swap verified.

**Suggested branch:** `feat/prod-snapshot-integrity`

---

## Wave 3 — Security P0

**Goal:** close cheap, high-impact holes before the port is reachable beyond the laptop.

| # | Work | Audit IDs |
|---|------|-----------|
| 3.1 | SPA path containment (`resolve` / `StaticFiles`) + test | S-03, T-04 |
| 3.2 | Non-root `USER` in Docker | S-07 |
| 3.3 | Strip notebook PII outputs; record history decision | S-01 |
| 3.4 | Network lock in runbook (ops) | S-02 P0 |
| 3.5 | `npm audit --omit=dev` + CI gate on critical prod path | S-08 |
| 3.6 | Body/row limits (baseline) | S-06 |

**Done when:** traversal cannot serve files outside `web/dist`; container is non-root; notebooks have no phone-like outputs.

**Suggested branch:** `feat/prod-security-p0`

---

## Wave 4 — Readiness & observability

**Goal:** separate “process is up” from “safe to take traffic”.

| # | Work | Audit IDs |
|---|------|-----------|
| 4.1 | `GET /ready`: file, age, rows, `schema_version` | D-06, OB-03, A009 #6 |
| 4.2 | Keep HEALTHCHECK on `/health` (liveness only) | A009 |
| 4.3 | JSON logs to stdout + `request_id` | OB-01 |
| 4.4 | `process_done` event (source, timings, snapshot age) | A005 §3.3 |
| 4.5 | Startup log (sources, schema, row_count; no secrets) | A005 |
| 4.6 | UI: show `snapshot_loaded_at` / stale warning | A005 / A010 |
| 4.7 | Backend `/health` test (not legacy `api.main`) | T-05 |
| 4.8 | Dockerfile: `exec` uvicorn as PID 1 (SIGTERM) | A009 #1 |

**Done when:** stale/missing snapshot → `/ready` ≠ 200; logs can diagnose wrong KPI / stale data.

**Suggested branch:** `feat/prod-ready-observability`

---

## Wave 5 — CI/CD & release hygiene

**Goal:** deploy by tag, not `compose build` from a working tree.

| # | Work | Audit IDs |
|---|------|-----------|
| 5.1 | CI builds image `vX.Y.Z` + `sha-*` | CD-01, G-01 |
| 5.2 | Image smoke: `/health`, `/ready`, non-root | SM-01/02, T-07 |
| 5.3 | Compose `IMAGE_TAG`; host only `pull && up` | A006, A011 |
| 5.4 | Post-deploy smoke SM-10…14 + rollback script | CD-02/03 |
| 5.5 | Refresh runbook + second operator | CD-05 |
| 5.6 | Protect `main`; drop dead `ci.yml` push branches | G-05/G-06 |
| 5.7 | E2E against committed snapshot fixture (not only synthetic) | RG-N10 |

**Done when:** internal host receives only a tagged image; rollback = previous tag + `.prev`.

**Suggested branch:** `feat/prod-cicd-tags`

---

## Wave 6 — Auth & security P1

| # | Work | Audit IDs |
|---|------|-----------|
| 6.1 | AuthN on `/api/v1/*` (SSO proxy or API key) | S-02 P1 |
| 6.2 | PII at rest: keyed hash at refresh **or** signed waiver | S-04/S-05 |
| 6.3 | Security regression suite in CI | S-14 |
| 6.4 | Disable `/docs` in prod; trim validation `input` echo | S-10 |
| 6.5 | TLS at proxy | S-09 |
| 6.6 | gitleaks + pip-audit | S-13 |

**Done when:** 401 without identity; `/health` open; PII decision recorded.

**Suggested branch:** `feat/prod-auth-p1`

---

## Wave 7 — Architecture cleanup

Safe after Waves 1–2 (source + snapshot settled).

| # | Work | Audit IDs |
|---|------|-----------|
| 7.1 | Move `run_process_db()` out of HTTP handler into service | A-07 |
| 7.2 | Split `create_app` into `APIRouter`s | M-03 |
| 7.3 | Public `data_access` module; stop private cross-imports | A-08, M-08 |
| 7.4 | Engine lifecycle / timeouts (if VIEW remains for dev) | A-03 |
| 7.5 | Typed settings; reduce config sprawl | A-05 |
| 7.6 | Remove stale `tts_guard` / `tts_order_bump` from `pyproject.toml` | A-09, M-12 |
| 7.7 | Lazy `tier3` / sklearn import | A-10, M-11 |
| 7.8 | Single-source app version (stop hardcoding `0.1.0`) | M-12, A005 |

**Done when:** OpenAPI unchanged in behaviour; easier to add endpoints/logging.

**Suggested branch:** `refactor/routers-data-access`

---

## Wave 8 — Maintainability / product twins

| # | Work | Audit IDs |
|---|------|-----------|
| 8.1 | Shared planner shell (Planner ↔ TTS pages) | M-01, A-06 |
| 8.2 | Direction-aware allocator (`five_percent` ↔ `tts`) | M-04/M-05 |
| 8.3 | TTS bounds from one backend source | M-02, C-03 |
| 8.4 | Shared tier-step table in `service.py` | M-06 |
| 8.5 | Shared snapshot base (q10012 ↔ tts_kpi) | M-07 |
| 8.6 | Tier naming aliases / docs | M-09 |
| 8.7 | Hash PII once at entry | M-10 |
| 8.8 | Dates/config: kitchen window, `ytd_2026` | A-11, M-16 |
| 8.9 | ruff/mypy + eslint `--max-warnings 0` | M-14/M-15 |
| 8.10 | Remove legacy `api/` after consumer check | M-13 |

**Done when:** one UX/rule change is one edit path; CI lint gates on.

**Suggested branch:** `refactor/planner-twins`

---

## Wave 9 — Performance & scale (metrics-driven)

| # | Work | Audit IDs |
|---|------|-----------|
| 9.1 | Gate `tracemalloc` behind debug flag | P-01 |
| 9.2 | Cap/disable large inline; body limit | P-02/P-05 |
| 9.3 | Optional uvicorn workers 2–4 | A007 |
| 9.4 | Result cache if measured p95 is poor | P-04 |
| 9.5 | Celery/RQ **only** if SLA broken or VIEW is production | A007 §1.2 |

**Done when:** p95 measured; no “queue just in case”.

---

## Wave 10 — Contracts & FE isolation (optional / defer)

| # | Work | Audit IDs |
|---|------|-----------|
| 10.1 | CI: OpenAPI ↔ Zod critical keys | C-01 |
| 10.2 | MSW fault harness (422/503/latency) | C-02 |
| 10.3 | TTS / Kitchen e2e | T-09/T-11 |
| 10.4 | Coverage thresholds | T-08 |

---

## Go-live gate (A009 summary)

Must be green **or explicitly waived in writing**:

- G-1
- D-01 … D-06
- S-01, S-03, S-07 + network lock (S-02 P0)
- `/ready` + structured logs
- Tagged image + rollback + snapshot backup + second operator
- Smoke SM-* + freshness alert

**Not** a go-live gate: zero-downtime, Kubernetes, Celery, full ABAC, Staging-as-a-platform.

---

## Suggested branch sequence

```text
0  decisions (runbook)
1  feat/prod-source-truth
2  feat/prod-snapshot-integrity
3  feat/prod-security-p0
4  feat/prod-ready-observability
5  feat/prod-cicd-tags
6  feat/prod-auth-p1
7  refactor/routers-data-access
8  refactor/planner-twins
9  perf/*                    (as needed)
```

---

## Out of scope for this plan

- Volume-weighted network mean / enterprise Targets write-back
- Full Angular StorePlanner / counterpart-pool parity
- Multi-tenant / Kubernetes
- Store/region ABAC without a business decision

---

## Sources

- `docs/production-audit/reports/REPORT-A001-architecture-coupling.md`
- `docs/production-audit/reports/REPORT-A002-db-data-integrity.md`
- `docs/production-audit/reports/REPORT-A003-security-hardening.md`
- `docs/production-audit/reports/REPORT-A004-testing-quality.md`
- `docs/production-audit/reports/REPORT-A005-observability.md`
- `docs/production-audit/reports/REPORT-A006-cicd-release-dr.md`
- `docs/production-audit/reports/REPORT-A007-performance-scalability.md`
- `docs/production-audit/reports/REPORT-A008-maintainability.md`
- `docs/production-audit/reports/REPORT-A009-production-readiness-golive.md`
- `docs/production-audit/reports/REPORT-A010-api-contracts-mocking.md`
- `docs/production-audit/reports/REPORT-A011-change-management-governance.md`
