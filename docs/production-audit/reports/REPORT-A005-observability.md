# REPORT-A005 — Observability: Logging, Metrics, Alerting, Incident Diagnosability

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A005](../specs/SPEC-A005-observability.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of `backend/*`, `Dockerfile`, `docker-compose.yml`, `scripts/refresh_*`, `web/src` (client telemetry). Container, uvicorn, and log shipping were **not** run; default uvicorn access/error logging is assumed from stock behaviour. |
| **Status** | Report ready (G-5, alert channel, freshness SLA open) |

> **Method note.** The Cursor search index is stale (lists deleted files such as
> `backend/tts_queries.py`). Every path below was checked with `Test-Path` / `git ls-files`.
> Cross-links: [REPORT-A002](./REPORT-A002-db-data-integrity.md) D-06 (`/ready`, freshness),
> [REPORT-A003](./REPORT-A003-security-hardening.md) (no PII in logs),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (smoke `SM-*`), A001 A-01/A-03.

---

## 1. Answer: are the logs enough to investigate a failure?

**No.**

- **Crash with traceback — Partial.** `logger.exception("pipeline failed")` produces a stack,
  but application loggers under `backend.*` have **no handlers**, so output goes through
  Python’s last-resort stderr handler: no timestamp, no route, no `request_id`, no version
  (`backend/main.py:359`, OBS-01).
- **Wrong KPI / stale data / slow request — No.** Telemetry
  (`execution_time_ms`, `db_query_a/b_time_ms`, `rows_scanned`, `query_b_mode`,
  `snapshot_loaded_at`) is built into response `meta` and reaches **only the browser**;
  it is never written server-side (`backend/main.py:341-350`, `backend/profiler.py:53-70`).
- **Non-500 failures** (422 “No Q10012 rows…”, 503 “Snapshot not found”, TTS 503/404) are
  **not logged** at the route layer (`main.py:204-210,290-296,352-358`). Logs appear only
  where a lower layer catches `SQLAlchemyError`.

---

## 2. Transparency scorecard

| Area | Score | Fact |
|------|-------|------|
| Logging | **Not ready** | No `logging.basicConfig` / `dictConfig` / `--log-config` in `backend` or `Dockerfile`. INFO is lost (e.g. “Mounted frontend SPA”, `main.py:492`). Refresh scripts configure `basicConfig` themselves (`scripts/refresh_*.py`). |
| Metrics | **None** | No Prometheus / OTel / StatsD; no server counters for requests, errors, or latency. |
| Tracing / correlation | **None** | No request-ID middleware; no `X-Request-ID` header. |
| Health | **Liveness only** | `/health` → static `HealthResponse(status="ok", version="0.1.0")` (`schemas.py:158-162`). Dockerfile `HEALTHCHECK` hits the same endpoint. Snapshot / DB dependencies are not checked. |
| Data freshness | **Invisible** | `loaded_at` and `row_count` exist in snapshot meta and in API `meta` (`snapshot.py:180-188`); the UI does not read them; no alerts (A002 D-06). |
| Error tracking | **None** | No Sentry (or equivalent). |
| Client telemetry | **None** | No `ErrorBoundary` / `window.onerror` / `reportError`; onboarding analytics is `console.debug` in DEV only (`web/src/onboarding/analytics.ts:19-24`). |
| Lifecycle | **Partial** | No startup/shutdown hooks; no startup log with version/config; compose `restart: unless-stopped` only restarts when the process exits. |

---

## 3. Logging specification

### 3.1 Format and destination

- **Stdout only**, one JSON object per line (container → `docker logs` / log shipper).
- Configure logging at app startup (lifespan) or via uvicorn `--log-config`. Either replace
  uvicorn’s access log with the request event below, or keep both without duplicating fields.
- Levels: `INFO` — normal events and successful requests; `WARNING` — expected 4xx and data
  degradation; `ERROR` — 5xx and data-dependency unavailability (503) with traceback.

### 3.2 Required fields per request (access / request event)

| Field | Source / note |
|-------|----------------|
| `ts` | UTC ISO-8601 |
| `level`, `event` | `request`, `request_failed` |
| `request_id` | Incoming `X-Request-ID` or new UUID; echo the same header on the response |
| `method`, `route` | Route **template** (`/api/v1/process`), not raw query values |
| `status`, `duration_ms` | Measured in middleware |
| `version` | Git SHA / image tag via env (today hardcoded `0.1.0`) |
| `client` | IP optional (decision O-5) |

### 3.3 `process_done` event (one line per `/process`)

`source` (`snapshot` / `view` / `inline`), `query_b_mode`, `period_start`, `period_end`,
`rows_scanned`, `query_a_total_responses`, `db_query_a_time_ms`, `db_query_b_time_ms`,
`execution_time_ms`, `snapshot_loaded_at`, `snapshot_age_s`, `enabled_tiers` (config booleans
only — no row values). This closes “wrong KPI” (A001 A-01) and “stale data” (A002 D-06)
without guessing.

### 3.4 Lifecycle and refresh

- `startup`: `version`, `sanitization_source`, `tts_kpi_source`, presence and
  `schema_version` of snapshot files, `loaded_at`, `row_count` (no filesystem paths or
  credential-bearing URLs).
- `shutdown`: reason.
- Refresh scripts (structured): `refresh_start`, `refresh_gate_failed` (which gate),
  `refresh_ok` (`rows`, `store_month_count`, `elapsed_s`, `loaded_at`), `refresh_fail`;
  non-zero exit on failure (already present) plus a **last-success marker** (e.g. meta key
  `last_success_at` + a log line) that drives `AL-08`.

### 3.5 Redaction (aligned with A003)

1. **Never log:** request bodies (`rows[]`), `UserContact` / `PhoneFromLog` values or their
   hashes, result rows, API keys, URLs with credentials, `os.environ` values.
2. Query strings: log only an allow-listed key set (store / year / month) or omit entirely.
3. Exceptions: `logger.exception` on the inline path can carry row values via `str(exc)`
   (pydantic / pandas); SQLAlchemy may append `[parameters: …]`. Prefer
   **exception class + route + request_id + traceback without message bodies that hold
   inline data**; SQL params only on the DB path, where they are dates / store IDs /
   constants (no PII).
4. Do not return filesystem paths to clients (A003 S-12); server logs may include them.
5. Enforce with a test (A004): a synthetic “PII marker” in the request body must not appear
   in log output.

### 3.6 Rotation and retention

`docker-compose.yml` has no `logging:` section → default `json-file` with no size cap.
Set `max-size` / `max-file` (or ship to an external collector). Retention is an owner
decision (O-4).

---

## 4. Monitoring & alerting scheme (minimum for internal launch)

Thresholds marked **TBD** wait on SLA (O-1 / O-3). Platform is not chosen (G-5): signals are
defined so they can be derived from logs, `/ready`, or an external probe.

| ID | Signal | Type | Threshold / condition | Severity | Notify |
|----|--------|------|------------------------|----------|--------|
| **AL-01** | Process unreachable | External probe `GET /health` | 2 consecutive failures in 1 min (30 s interval) | High | Channel TBD (O-2) |
| **AL-02** | Not ready: snapshot missing / empty / `schema_version` mismatch | `/ready` ≠ 200 | ≥ 5 min | High | TBD |
| **AL-03** | 5xx rate | Metric from request log | > 5% of `/api/v1/*` over 5 min **or** any 500 on `/process` | High / Medium | TBD |
| **AL-04** | Data dependency unavailable (503) | Log `level=ERROR`, status 503 | ≥ 1 in 5 min | High | TBD |
| **AL-05** | `/process` latency | `duration_ms` p95 | **TBD** from first baseline of `execution_time_ms` (not measured) | Ticket | TBD |
| **AL-06** | Snapshot stale | `/ready` → `snapshot_age_s` | warn > 1× SLA, high > 2× SLA (**SLA TBD**, O-1; live file ~43 days today) | Medium → High | TBD |
| **AL-07** | `row_count` drop | `/ready` / `refresh_ok` | `rows` < floor or < N% of previous snapshot (**N TBD**) | High | TBD |
| **AL-08** | Refresh failed / did not run | `last_success_at` | No success within SLA window **or** `refresh_fail` | High | TBD |
| **AL-09** | Container restart loop | Docker / host | > 2 restarts in 10 min | High | TBD |
| **AL-10** | Disk: logs and `data/` | Host | Free < 20% | Ticket | TBD |

**Minimal metric set** (names illustrative): `http_requests_total{route,status}`,
`http_request_duration_ms{route}`, `process_runs_total{source,query_b_mode}`,
`snapshot_age_seconds`, `snapshot_row_count`, `snapshot_schema_ok`,
`refresh_last_success_timestamp`, `refresh_runs_total{result}`. **Log-derived metrics are
enough at launch**; Prometheus / OTel wait on G-5.

**Health vs ready.** Docker `HEALTHCHECK` must stay **liveness** (`/health`): a stale
snapshot must not mark the container unhealthy while the process is fine. Data readiness
is a separate `/ready` for an external probe. Without an orchestrator, `HEALTHCHECK` alone
does not restart the container.

Whether `/ready` needs auth (it exposes age and row counts) is O-6 (ties to A003 P1-1).

---

## 5. Incident diagnosability — four scenarios

| # | Scenario | Evidence **today** | Gaps | Spec closes with |
|---|----------|--------------------|------|------------------|
| **I-1** | `/process` returns 500 | Traceback on stderr without time/route (`main.py:359`); uvicorn access line (path, status) | Cannot join traceback to request, period, source, or version | `request_id` + `process_done` / `request_failed` + `version` |
| **I-2** | “KPI does not match” / stale data | Only `meta` in the user’s response (`snapshot_loaded_at`, `query_b_mode`); UI does not show them | No server record of source/mode; stale invisible until a complaint | `process_done` with `source`, `query_b_mode`, `snapshot_age_s`; `AL-06`; `/ready` |
| **I-3** | Container restarted / “unhealthy” | `docker ps`, `docker logs`; static `/health` | No startup log with version/config (INFO lost); unbounded log growth; unhealthy does nothing | Startup/shutdown events; rotation; `AL-01`, `AL-09` |
| **I-4** | Refresh silently failed | Operator console, script exit code; file mtime | No schedule, no last-success marker, no alert (INFRA-01) | `refresh_*` events, `last_success_at`, `AL-08` |

---

## 6. Findings registry

| ID | Finding | Evidence | Verdict | Class | Sev | Effort | Fix |
|----|---------|----------|---------|-------|-----|--------|-----|
| **OB-01** | No logging configuration: `backend.*` has no handlers; INFO is lost; `logger.exception` lacks timestamp/context; no JSON | `main.py:64,359,492`; no `basicConfig` / `dictConfig` / `--log-config` | Confirmed | **Release blocker** | High | S–M | Configure at startup; JSON to stdout (§3) |
| **OB-02** | No `request_id` / correlation | Grep: no middleware; `main.py:104` is CORS only | Confirmed | **Release blocker** | High | S | Middleware: `X-Request-ID`, fields in §3.2 |
| **OB-03** | Liveness only; no readiness; `/health` is static | `schemas.py:158-162`; Dockerfile `HEALTHCHECK` | Confirmed | **Release blocker** | High | S | `/ready`: file present, age, rows, `schema_version`; keep `/health` as liveness |
| **OB-04** | Data freshness invisible to UI and ops | `snapshot.py:180-188`; A002 D-06 | Confirmed | **Release blocker** (same fix as OB-03 + AL-06) | High | S | `/ready` + `AL-06/07` |
| **OB-05** | Domain failures (422/503) not logged at the route; successful `/process` leaves no server trail; telemetry only in `meta` | `main.py:204-210,290-296,341-358` | Confirmed | **Release blocker** (one `process_done` line) | Med–High | S | §3.3 + WARNING/ERROR for 4xx/5xx |
| **OB-06** | No external probe or alert channel: failure is invisible until users complain; `HEALTHCHECK` without an orchestrator does nothing; no log rotation | `docker-compose.yml` (no `logging:`; `restart: unless-stopped`) | Confirmed | **Release blocker** (minimum: probe + channel + rotation) | High | S | `AL-01/02/09`, rotation; platform → G-5 |
| **OB-07** | Refresh has no observability: console + exit code only; no schedule, no last-success marker, no alert | `scripts/refresh_*.py`; INFRA-01 | Confirmed | **Release blocker** | High | S–M | Events in §3.4 + `AL-08` |
| **OB-08** | PII risk in logs: exceptions / SQL params may carry values; no redaction policy | §3.5; A003 | Potential | **Release blocker** as acceptance for OB-01 | Med | S | Redaction §3.5 + test |
| **OB-09** | No deploy version identity: `0.1.0` hardcoded; image tag `:local` | `schemas.py:162`, FastAPI `version`, compose | Confirmed | **Defer** (rides with INFRA-02; wire `version` field now) | Med | S | Env `APP_VERSION` / git SHA in logs and `/ready` |
| **OB-10** | No error tracking or server metrics (OBS-02) | Grep Sentry / OTel / Prometheus → 0 | Confirmed | **Defer** (G-5; log-derived metrics enough at launch) | Med | M | After platform choice |
| **OB-11** | No client telemetry: no `ErrorBoundary` / `window.onerror`; onboarding analytics is DEV `console.debug` only | `web/src/onboarding/analytics.ts:19-24`; grep | Confirmed | **Defer** | Low–Med | S–M | Minimum: `ErrorBoundary` + report to backend after G-5 |
| **OB-12** | `tracemalloc` on every `/process` skews `peak_memory_mb` and costs latency | `backend/profiler.py:31-49`; PERF-01 | Confirmed | **Defer** (A007) | Med | S | Behind a debug flag; do not use as an SLO metric |
| **OB-13** | No startup/shutdown hooks (lifespan) and no startup log with version/config | `create_app()` | Confirmed | **Defer** (ship with OB-01) | Low–Med | S | Lifespan: validate config + startup event + dispose |

---

## 7. Release blocker backlog vs Defer

**Blockers (minimum observability package before release):** OB-01, OB-02, OB-03/OB-04,
OB-05, OB-06, OB-07, OB-08. Order:

1. OB-01 + OB-02 + OB-05 + OB-08 (logging and request ID — one PR).
2. OB-03 / OB-04 (`/ready`, freshness — shared with A002).
3. OB-06 + OB-07 (external probe, channel, rotation, refresh events and `last_success_at`).

**Done criteria:** structured JSON logs with `request_id`, `route`, `status`, `duration_ms`,
`version`; `process_done` on every `/process`; `/ready` reports age / rows /
`schema_version` and returns non-200 when missing; probe covers `AL-01/02`; log rotation;
test that PII does not appear in logs; `AL-08` fires on a missed refresh.

**Defer:** OB-09 (with INFRA-02), OB-10, OB-11, OB-12, OB-13. Full distributed tracing is
not required for a single-host monolith; `request_id` is enough.

---

## 8. Re-verification of seed (OBS-*, DATA-04)

| Seed | Verdict | Note |
|------|---------|------|
| OBS-01 | **Confirmed** | Clarified: uvicorn access/error loggers work; `backend.*` app loggers do not; refresh scripts configure `basicConfig` themselves |
| OBS-02 | **Confirmed** | No error tracking or server metrics; client telemetry also absent (OB-11) |
| OBS-03 | **Confirmed** | Liveness only; added: no lifespan / startup log (OB-13) |
| DATA-04 | **Confirmed** | Matches A002 D-06; signals `AL-06/07`; shared fix with OB-03 |
| PERF-01 (diagnosability impact) | **Confirmed** | → OB-12 |

---

## 9. Open questions

- **O-1.** Snapshot freshness SLA (shared with A002 O-1) — sets `AL-06`.
- **O-2.** Alert channel and on-call: where do alerts go (mail / messenger / ticket), who responds?
- **O-3.** Latency SLO for `/process` (no baseline yet) — sets `AL-05`.
- **O-4.** Log retention and who reads logs; is there a host log shipper?
- **O-5.** Log client IP (internal network vs privacy)?
- **O-6.** Should `/ready` sit behind auth (A003 P1-1) or stay open for the probe?
- **G-5.** Monitoring / error-tracking platform (not chosen in this audit).

---

## 10. Limitations

- Container, uvicorn, and log pipeline were not run; default uvicorn log format was not
  verified live.
- `AL-05/06/07` thresholds are TBD: no latency baseline and no agreed freshness SLA.
- `web/src` was sampled for client telemetry via grep only.
- Stale search index: deleted files excluded after `Test-Path` / `git ls-files`.

---

## Acceptance check (SPEC-A005 §7)

- [x] REPORT-A005 created; “are the logs enough?” answered explicitly (§1: **No**).
- [x] Logging spec (§3) + monitoring/alerting scheme (§4) present.
- [x] Pre-user alerts listed with thresholds or explicit “TBD with SLA” (§4).
- [x] OBS-* re-verified (§8); README index A005 updated.
