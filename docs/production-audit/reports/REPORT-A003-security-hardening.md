# REPORT-A003 — Security: AuthZ, Secrets, Input Validation, OWASP Top 10

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A003](../specs/SPEC-A003-security-hardening.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of code and config; `git` metadata (no PII values printed). No live systems, no `npm audit`, no Python CVE scan, no tests run. |
| **Status** | Report ready (open decisions: IdP, git history, pepper) |

> **Method note.** The Cursor search index is stale (lists files deleted in `3df409e`, e.g.
> `backend/tts_queries.py`). Every path below was checked with `Test-Path` / `git ls-files`.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (A-05 config sprawl),
> [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-17 plaintext PII in snapshot).
> No exploit PoC / attack scripts; no history rewrite.

---

## 1. Answer: how is authorization implemented?

**RBAC / ABAC: not implemented.** There is no authentication either.

- No `Depends`, `Security`, bearer/API-key check, or auth middleware on any route in
  `backend/main.py`. The only key in the codebase is the **outgoing** DreamFactory header
  (`backend/tts_kpi_ap.py:36,107-110`).
- All `/api/v1/*`, `/health`, `/docs`, `/openapi.json`, and the SPA are served to anyone who
  can reach the port. The container listens on `0.0.0.0:8000` (`Dockerfile` CMD; compose maps
  `${API_PORT:-8000}:8000`).
- **Interim controls that exist today:**
  1. `/process` returns aggregates only; entity PII is hashed in `redact_row` before the
     pipeline (`backend/db_sample.py:79-85`).
  2. App data stores are read-only (SQLite mounted `:ro`; SQL is parameterized SELECTs).
  3. Intended LAN-only use (README / assessment).
  None of these is access control. Network restriction is an ops dependency, not enforced
  by the app.

**Minimal model for internal launch:**

1. **P0, no code:** lock the port to a trusted network segment / bind to an internal interface.
2. **P1:** authenticate every `/api/v1/*` call through a reverse proxy or in-app dependency
   (SSO / OIDC proxy preferred; shared API key is an acceptable stop-gap). `/health` stays open.
3. **Roles:** one role is enough at launch — `authenticated internal user` (all endpoints are
   read/compute). A second role (`operator`) is only needed if refresh/export ever moves behind
   an API. Refresh and exports are CLI scripts today, outside the API. **ABAC** (by store /
   region) is not required for launch: responses carry no store-level PII, and a business
   decision is needed first (O-2).

---

## 2. OWASP Top 10 (2021) matrix

| # | Category | Status | Evidence / note |
|---|----------|--------|-----------------|
| A01 | Broken Access Control | **GAP** | No authN/authZ (SEC-02 / S-02). SPA catch-all path containment missing (SEC-05 / S-03). |
| A02 | Cryptographic Failures | **GAP** | Plain HTTP on `0.0.0.0`, no TLS. PII plaintext in snapshot (SEC-03). Unsalted SHA-256 truncated to 32 hex (SEC-04, `src/fraud_guard/pii.py:24`). |
| A03 | Injection | **OK with note** | Bound parameters everywhere (`queries.py`, `db_sample.py`, `tts_kitchen_queries.py`, `tts_kpi_ap.py`). Interpolated identifiers are constants or regex-checked: `_VIEW_NAME` (`tts_kitchen_queries.py:30`), `_IDENT` / `qualify_table` (`src/planner/tts_kpi_ap.py:22,47`). DreamFactory filter built from constants. |
| A04 | Insecure Design | **GAP** | No threat model; “internal only” assumed, not enforced. Large unauthenticated payloads (S-06). |
| A05 | Security Misconfiguration | **GAP** | Container as root (no `USER`). `/docs` + OpenAPI exposed. CORS `allow_credentials=True` with `allow_methods/headers=["*"]` (`main.py:104-110`). No security headers, no body limit. |
| A06 | Vulnerable Components | **GAP / not re-verified** | Assessment: critical/high npm advisories (`maplibre-gl`, `seroval`/`solid-js`, `zod`). `web/package.json` has `zod ^3.24.2`. CI has no `npm audit` / `pip-audit` / secret scan (`.github/workflows/ci.yml`). Python CVEs never assessed. |
| A07 | Identification & Authentication Failures | **GAP** | Same as A01: no authentication. |
| A08 | Software & Data Integrity | **GAP (partial)** | No image build/sign in CI (INFRA-02); snapshot integrity is A002. |
| A09 | Logging & Monitoring | **GAP** | No request-ID / structured access logging (OBS track). Exception paths avoid payloads (`from None` for AP/DreamFactory errors) — good. |
| A10 | SSRF | **N/A (low)** | `TTS_KPI_API_URL` is operator env, not user input; `httpx` does not follow redirects by default; errors do not echo URL or key. |

**XSS note.** No `dangerouslySetInnerHTML` or `.innerHTML =` in `web/src` outside one test
file. API responses are Zod-parsed in one place (`web/src/api/client.ts`, per A001). Browser
storage holds UI state and aggregate results only (`sessionStorage` / `localStorage`).

---

## 3. Findings registry

| ID | Finding | OWASP / theme | Evidence | Verdict | Class | Sev | Effort | Fix |
|----|---------|---------------|----------|---------|-------|-----|--------|-----|
| **S-01** | **Raw phone numbers in tracked notebook outputs.** `notebooks/03_tier3_experiments.ipynb` has 15 phone-like matches at HEAD (counts only; values not printed). Notebooks 00–02 have 0 matches. All four notebooks carry cell outputs. Remote is GitHub `origin` with many `origin/*` branches; notebooks entered at `c4c5fb4` (initial commit), so history contains them. | A02 / PII in repo | `git ls-files`, regex count, `git log` | Confirmed | **Release blocker** | High | S (strip) + owner decision (history) | Strip outputs from tracked notebooks; confirm visibility/clones (O-3); decide on history rewrite. Do not rewrite in this audit. |
| **S-02** | **No authentication or authorization.** | A01 / A07 | §1 | Confirmed | **Release blocker** unless P0 network lock is in place | High | S (P0) / M (P1) | P0 network lock now; P1 proxy/dependency auth; 401 without identity |
| **S-03** | **Possible path traversal in SPA catch-all.** `candidate = root / full_path; if candidate.is_file(): return FileResponse(candidate)` with no `resolve()` / `is_relative_to(root)` check. As root in the container, reachable files could include process environment (secrets from `env_file`). Not exploited here. | A01 / path | `backend/static_ui.py:36-43`; no `StaticFiles` | Potential (high credibility) | **Release blocker** | High | S | `candidate.resolve().is_relative_to(root.resolve())` or `StaticFiles(html=True)`; regression test with `..` and absolute-style forms |
| **S-04** | **Plaintext PII at rest in SQLite snapshot** (`UserContact`, `PhoneFromLog`); file lives on host and is bind-mounted. | A02 | `backend/snapshot.py:38-42`; `refresh_q10012_snapshot.py:163-164`; A002 D-17 | Confirmed | **Release blocker** (until encrypted-disk / hash-at-refresh decision) | High | M | Hash with keyed scheme at refresh; or document disk encryption + access control as compensating control |
| **S-05** | **Weak pseudonymization.** `hash_pii_value` is SHA-256, no salt/pepper, truncated to 32 hex; small phone space is brute-forceable. `/process` does not return hashes, so exposure is memory/logs/exports. Export scripts reference entity keys (`export_always5_entities.py` — not reviewed in depth). | A02 | `src/fraud_guard/pii.py:13-26` | Confirmed pattern / potential effect | **Defer** (blocker if hashes are exported/shared) | Med | S–M | Keyed HMAC with pepper from secret store; ties to S-04 |
| **S-06** | **No request size / abuse limits.** `ProcessRequest.rows` max 500,000; `SurveyAnswerRow` has `extra="allow"`; no body-size limit; no rate limiting. | A04 / DoS | `backend/schemas.py:70,100` | Confirmed | **Defer** with P0 network lock; blocker without it | Med | S | Body limit at proxy/uvicorn; lower row cap; `extra="ignore"` or allow-list; rate limit |
| **S-07** | **Container runs as root**; no `USER`; compose has no `read_only` / `cap_drop` / `no-new-privileges`. Amplifies S-03. | A05 | `Dockerfile` (no `USER`) | Confirmed | **Release blocker** (cheap) | Med | S | Non-root user; `chown` data dir; read-only rootfs where possible |
| **S-08** | **Frontend dependency advisories** (assessment: critical via `maplibre-gl`/`plotly.js`, critical via `seroval`/`solid-js` in react-query-devtools, high `zod`). Not re-run now. Python deps never scanned. CI has no audit step. | A06 | assessment SEC-06; `web/package.json`; `ci.yml` | Confirmed (assessment); **not re-verified** | **Release blocker** only for advisories on the production bundle path — verify first | High | S–M | Re-run `npm audit --omit=dev`; fix or document exploitability; add CI audit + optional `pip-audit` |
| **S-09** | **No TLS / plain HTTP, bound to all interfaces.** | A02 / A05 | `Dockerfile`, `docker-compose.yml` | Confirmed | **Defer** with network lock + proxy | Med | S–M | Terminate TLS at proxy; publish only on internal interface |
| **S-10** | **`/docs`, `/openapi.json` publicly served**; validation errors echo pydantic `input` to the caller. | A05 | `create_app()` defaults; `main.py:112-121` | Confirmed | **Defer** | Low | S | Disable docs in prod; strip `input` from error payloads |
| **S-11** | **CORS config:** `allow_credentials=True`, wildcard methods/headers; origin list from env; defaults diverge from `db/config` (A001 A-05). | A05 | `backend/main.py:69-110` | Confirmed | **Defer** (no cookies/auth today) | Low | S | Explicit methods/headers; tighten when auth lands |
| **S-12** | **Error disclosure of filesystem path:** `"Snapshot not found at {path}"` in 503 detail. Other error classes avoid secrets (`TtsKpiSourceError` docstring; `from None`). | A05 | `snapshot.py:198-203` | Confirmed | **Defer** | Low | S | Generic client text; log path server-side |
| **S-13** | **Secrets hygiene is mostly good.** `.env*` ignored (`!.env.example`, `!.env.docker.example`); examples have empty secrets; `web/.env.docker` tracked but holds no secret; Dockerfile bakes none. No secret scan of history or CI. | A02 / secrets | `.gitignore`, `.env*.example` | Confirmed | **Defer** | Low | S | Add gitleaks (or equivalent) in CI after Approval |
| **S-14** | **No security regression tests** (auth, traversal, payload size, PII-in-logs). | A04 | assessment; `tests/` | Confirmed | **Release blocker** as acceptance for S-02, S-03, S-06 | Med | S | Add tests alongside each fix |
| **S-15** | Plan / TTS payload limits not individually verified. Earlier search hits for `tts_schemas` / order-bump limits belong to **deleted** files (`Test-Path` = False). | A04 | `backend/plan_schemas.py`, `tts_plan_schemas.py` not reviewed in depth | Potential | **Defer** | Low–Med | S | Review in same pass as S-06 |

---

## 4. Security Hardening Checklist (before internal release)

### P0 — before anyone outside the dev machine can reach it

| # | Item | Findings | Done criteria |
|---|------|----------|---------------|
| P0-1 | Strip PII from tracked notebooks; confirm repo visibility and clone/fork list; owner decides on history rewrite | S-01 | `git grep` for phone-like patterns in `notebooks/` returns 0; owner decision recorded (O-3) |
| P0-2 | Network lock until auth exists: publish only on an internal interface / segment | S-02, S-09 | Port unreachable from non-approved subnets; recorded in runbook |
| P0-3 | SPA path containment | S-03 | Test with `..`-style and absolute-style paths returns index or 404, never a file outside `web/dist` |
| P0-4 | Run as non-root | S-07 | `docker exec … id` shows non-root; `/health` and a snapshot `/process` still work |

### P1 — before declaring release

| # | Item | Findings | Done criteria |
|---|------|----------|---------------|
| P1-1 | AuthN on `/api/v1/*` (SSO proxy or dependency) | S-02 | 401 without identity; `/health` open; e2e uses test identity |
| P1-2 | PII at rest decision: hash at refresh (keyed) or documented compensating control | S-04, S-05 | `answers` has no raw contact/phone, or signed-off compensating control; KPI parity tests pass |
| P1-3 | Dependency audit: re-run and fix criticals; add CI step | S-08 | `npm audit --omit=dev` has no critical on production path; CI fails on it |
| P1-4 | Request limits | S-06, S-15 | Oversized payload → 413/422; UI maximum still works |
| P1-5 | Security regression tests | S-14 | Tests for P0-3, P1-1, P1-4 in CI |

### P2 — hardening after launch

| # | Item | Findings | Done criteria |
|---|------|----------|---------------|
| P2-1 | TLS via proxy | S-09 | HTTPS only on the published endpoint |
| P2-2 | Disable `/docs` in prod; trim validation error echo | S-10 | `/docs` returns 404 in prod config |
| P2-3 | Tighten CORS; generic snapshot-path errors | S-11, S-12 | Explicit methods/headers; no filesystem path in API responses |
| P2-4 | Secret scanning in CI; Python `pip-audit` | S-13, S-08 | Both run on PR |

---

## 5. Defer / accept risk (internal-only)

S-05, S-06 (only with P0-2), S-09, S-10, S-11, S-12, S-13, S-15.

All are low-likelihood once P0-2 is in place and carry no direct PII exposure in API responses.
**S-05 flips to a blocker** if hashed entity keys are exported or shared outside the team (O-5).

---

## 6. Open decisions

- **O-1.** IdP: is there corporate SSO / OIDC to put in front of the API? (assessment G-2)
- **O-2.** Is one `authenticated internal user` role enough, or are store/region restrictions (ABAC) a business requirement?
- **O-3.** GitHub repo: private or public? Who has access; any forks or external clones? Decision on history rewrite (**not performed here**).
- **O-4.** Pepper / HMAC key distribution for keyed hashing (owner + storage).
- **O-5.** Are hashed entity keys exported today (`scripts/export_always5_entities.py`)? Controls whether S-05 is a blocker.
- **O-6.** Is the production host on a network segment where P0-2 can actually be enforced?

---

## 7. Re-verification of assessment SEC-*

| Seed | Verdict | Note |
|------|---------|------|
| SEC-01 | **Confirmed, narrowed** | PII-like values in notebook 03 only (15 matches at HEAD); history exposure via initial commit |
| SEC-02 | **Confirmed** | No auth constructs on the server side |
| SEC-03 | **Confirmed** | → S-04; A002 D-17 |
| SEC-04 | **Confirmed pattern** | Exposure limited unless hashes leave the process |
| SEC-05 | **Confirmed pattern, potential impact** | Not exploited; fix is cheap → S-03 |
| SEC-06 | **Not re-verified** | Needs a fresh `npm audit`; CI has no audit step → S-08 |
| SEC-07 | **Confirmed** | `max_length=500_000` exists; no body limit → S-06 |
| SEC-08 | **Confirmed** | No `USER` in `Dockerfile` → S-07 |
| ARCH-03 (secrets/config) | **Confirmed; no hardcoded secrets found** | Config sprawl remains A001 A-05 |

---

## 8. Limitations

- No `npm audit`, no Python CVE scan, no git-history secret scan, no Docker run, no dynamic testing.
- Notebook and export-script review is by pattern **count** only; PII values were not displayed.
- Plan / TTS payload schemas not reviewed in depth.
- Deleted TTS modules from search index were excluded after `Test-Path` / `git ls-files`.

---

## Acceptance check (SPEC-A003 §7)

- [x] REPORT-A003 created; RBAC/ABAC question answered explicitly (§1).
- [x] OWASP matrix + Security Hardening Checklist present (§2, §4).
- [x] Assessment SEC-* re-verified (§7).
- [x] Every blocker has a concrete fix + Done criteria in the checklist.
- [x] README index: A003 → Spec + Report + status.
