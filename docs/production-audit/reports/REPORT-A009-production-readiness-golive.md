# REPORT-A009 — Production Readiness: Graceful Shutdown, Probes & Go-Live

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A009](../specs/SPEC-A009-production-readiness-golive.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of `backend/main.py`, `backend/schemas.py`, `Dockerfile`, `docker-compose.yml`, plus gate aggregation from A001–A006. Container stop, SIGTERM, and a real cutover were **not** executed. |
| **Status** | Report ready (G-1 / freshness SLA / alert channel / registry-host / RPO-RTO / network-lock sign-off open) |

> **Reality check.** The orchestrator today is **Docker Compose on a single host**, not Kubernetes.
> “Seamless switch” means an image-tag change plus an atomic snapshot file plus probes — not a
> blue/green mesh. There is no application OLTP database; “migration” means snapshot swap and
> `schema_version`.
> Cross-links: [REPORT-A001](./REPORT-A001-architecture-coupling.md) (G-1),
> [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-01/02/04/05/06),
> [REPORT-A003](./REPORT-A003-security-hardening.md) (P0),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (SM-10…14),
> [REPORT-A005](./REPORT-A005-observability.md) (OB-01/02/03),
> [REPORT-A006](./REPORT-A006-cicd-release-dr.md) (CD-01…05). This report does not redo those designs.

---

## 1. Answers (explicit)

### 1.1 Graceful shutdown?

**Partial — effectively no.**

- No FastAPI `lifespan`; no engine `dispose` (`backend/main.py`). Engines are created per call and not held (A007 P-06).
- `Dockerfile:54` is `CMD ["sh", "-c", "uv run uvicorn …"]`. PID 1 is `sh`, not uvicorn. Docker sends `SIGTERM` to PID 1, so uvicorn’s stock graceful drain is not what the signal hits.
- After the stop timeout (Docker default 10s) the container is `SIGKILL`ed. An in-flight `POST /process` is cut.
- **Confirmed** that uvicorn is not PID 1. Exact `sh` signal-forwarding was **not executed**.
- Stopping the API does **not** corrupt the snapshot: the process does not write it. Data corruption is the host refresh path (A002 D-01), not API shutdown.

### 1.2 How does the orchestrator tell liveness from readiness?

**It does not.**

| Probe | As-is | What it proves |
|-------|--------|----------------|
| Liveness | `GET /health` → static `{"status":"ok","version":"0.1.0"}` (`schemas.py:158-162`). Docker `HEALTHCHECK` hits it (`Dockerfile:51-52`). | Process accepts HTTP. |
| Readiness | **None.** No `/ready`. No check for snapshot file, age, row count, or `schema_version`. | — |
| Compose | `restart: unless-stopped`. Does **not** restart a container that is `unhealthy`. | Only “process exited”. |

A missing snapshot, an empty pull, or a 43-day-old file still leaves `/health` green (A002 D-06, A005 OB-03, A006 CD-03).

### 1.3 Ready for a seamless switch?

**No.**

- Zero downtime is impossible: one container; stop = downtime.
- A maintenance-window swap is also unsafe today: in-place snapshot write (D-01), single-file bind mount pins the inode (D-02), no `schema_version` (D-05), empty pull is not rejected (D-04), `/health` stays green on bad data (CD-03), image tag is always `:local` with no rollback (CD-01/02), no backup (CD-04).

**Target for internal v1:** a documented maintenance window, not blue/green. Zero-downtime and Kubernetes probes are **Defer**.

---

## 2. As-is ops posture

| Area | As-is |
|------|--------|
| Process | One uvicorn via `sh -c` / `uv run`. No workers, no lifespan, no `--timeout-graceful-shutdown`. |
| Stop | Docker `SIGTERM` → `sh`. In-flight sync `/process` dies at the stop timeout. |
| Live vs ready | One static `/health`. Compose treats “running” as “ready”. |
| Data | Host refresh writes the live SQLite file. Container bind-mounts that file `:ro`. |
| Deploy | Manual `docker compose build && up`. Image `fraud-dq-sanitization:local`. No previous tag. |
| Rollback | Rebuild an old git tag (needs network). No snapshot restore. |
| Observe | No app logging config, no request id, no `/ready` alert (A005). |

---

## 3. Go-Live Checklist (internal launch)

| # | Gate | Category | Required evidence | Status | Owner | Blocker? |
|---|------|----------|-------------------|--------|-------|----------|
| 1 | SIGTERM reaches uvicorn (`exec`, not `sh -c`) | Shutdown & lifecycle | `Dockerfile:54` | **Fail** | Backend | Defer* (window OK; fix is S, same PR as non-root) |
| 2 | Lifespan disposes engines; no leaked pools | Shutdown & lifecycle | No `lifespan` in `main.py` | **Fail** | Backend | Defer if G-1 = snapshot-only (A007 P-06) |
| 3 | In-flight `/process` is not cut silently | Shutdown & lifecycle | Sync handler; stop ≈ 10s | **Fail** | Ops | Defer under an announced window |
| 4 | Liveness `/health` means “process up” | Liveness | `schemas.py:158-162` | **Pass** | — | — |
| 5 | Unhealthy is not treated as “send traffic” | Liveness | HEALTHCHECK → `/health`; compose ignores `unhealthy` | **Fail** | Ops | **Blocker** with #6 (A005 OB-03, A006 CD-03) |
| 6 | `/ready`: file, age, rows, `schema_version`. Do **not** point liveness HEALTHCHECK at it | Readiness/data | No `/ready`; no `schema_version` | **Fail** | Backend | **Blocker** (A002 D-05/D-06) |
| 7 | Atomic snapshot swap + mount the `data/` directory | Readiness/data | D-01, D-02 | **Fail** | Data | **Blocker** |
| 8 | Empty / partial pull does not replace a good file | Readiness/data | D-04 | **Fail** | Data | **Blocker** |
| 9 | Freshness: SLA, refuse when older than the threshold | Readiness/data | Snapshot ~43 days old at audit date; SLA unsigned | **Fail** | Product/Ops | **Blocker** once O-1 (A002) is signed |
| 10 | G-1: prod = snapshot-only; VIEW not in the image | Config freeze | Docker `snapshot`; code default `view` | **Fail** | Product | **Blocker** (A001) |
| 11 | Port reachable only from the internal segment | Secrets & access | `0.0.0.0:8000`, no auth | **Fail** | Ops | **Blocker** until P0-2 (A003 S-02). In-app auth (P1) **Waive** if the lock is written down |
| 12 | SPA path containment | Secrets & access | `static_ui.py` | **Fail** | Backend | **Blocker** (S-03) |
| 13 | Non-root container | Secrets & access | No `USER` | **Fail** | Backend | **Blocker** (S-07) |
| 14 | Notebook PII outputs stripped; history decision recorded | Secrets & access | A003 S-01 | **Fail** | Owner | **Blocker** |
| 15 | Snapshot PII: disk encryption or hash-at-refresh, decision recorded | Secrets & access | A003 S-04 | **Fail** | Security | **Blocker** until a decision (Waive only with a written compensating control) |
| 16 | Image tagged by git tag/SHA, not `:local` | Deploy & rollback | A006 CD-01 | **Fail** | Ops | **Blocker** |
| 17 | Rollback = previous tag + `schema_version` check | Deploy & rollback | CD-02 | **Fail** | Ops | **Blocker** |
| 18 | Post-deploy smoke and auto-rollback | Deploy & rollback | SM-10…14 described, no procedure (A004) | **Fail** | QA/Ops | **Blocker** (CD-03) |
| 19 | Snapshot backup taken before cutover; restore tried on a copy | Data backup | CD-04 / INFRA-05 | **Fail** | Ops | **Blocker** |
| 20 | A second person can run refresh (not a SPOF) | Data backup | CD-05 | **Fail** | Ops | **Blocker** (minimum: runbook + second operator) |
| 21 | Logs: JSON, `request_id`, one `process_done` line | Observability min | A005 OB-01/02/05 | **Fail** | Backend | **Blocker** |
| 22 | Alert when not ready (channel still open) | Observability min | AL-02; G-5 open | **Fail** | Ops | **Blocker** once the channel is chosen; thresholds follow #9 |
| 23 | Pre-traffic smoke: `/`, `/ready`, `source=db` `/process`, TTS KPI | Smoke tests | T-05/T-07 not in place | **Fail** | QA | **Blocker** |
| 24 | Config freeze: tag, env, snapshot `loaded_at` written in the runbook | Config freeze | None | **Fail** | Ops | **Blocker** as a procedure, not as code |

\*Defer on rows 1–3: an announced window is acceptable for internal v1. The `exec` form is cheap and belongs in the same PR as non-root. Zero-downtime and multiple replicas are **Defer**, not a gate.

**Score:** 1 Pass / 23 Fail. No row is Waived yet — waivers need a written owner decision (rows 11 and 15).

---

## 4. Cutover runbook sketch (target — not executable as-is)

1. **Freeze.** Record image tag, `.env.docker`, `loaded_at`, `schema_version`, free disk.
2. **Pre.** Snapshot files present; age ≤ SLA; backup copy; `previous_tag` known. Otherwise cancel; change nothing.
3. **Window.** Tell users. `docker compose stop` (after row 1, uvicorn receives `SIGTERM`).
4. **Data.** New snapshot to a temp file → checks (rows, meta, `schema_version`) → atomic replace inside the mounted `data/` directory.
5. **Start.** `IMAGE_TAG=vX docker compose up -d`. Wait until `/health` = 200 **and** `/ready` = 200.
6. **Smoke.** SM-10…14 within ≤ 5 min. On failure: previous tag + previous snapshot file.
7. **Live.** Only after smoke. Record the actual tag and `loaded_at`.

Steps 2, 4, 5, and 6 have no implementation today.

---

## 5. Blockers vs waivers

**Must be green (or explicitly waived) before internal traffic:**

| Source | IDs |
|--------|-----|
| A001 | G-1 (snapshot-only) |
| A002 | D-01, D-02, D-04, D-05, D-06 |
| A003 | P0: S-01, S-02 via network lock, S-03, S-04, S-07 |
| A004 | Refresh/schema tests (T-03), backend `/health` test (T-05), post-deploy smoke SM-* |
| A005 | OB-01, OB-02, OB-03 |
| A006 | CD-01, CD-02, CD-03, CD-04, CD-05 |

**Waivable for internal LAN (write the decision):** in-app auth P1 if the network lock (row 11) is in the runbook; snapshot-at-rest encryption (row 15) only with a named compensating control.

**Defer (not a go-live gate):** zero-downtime / second replica; Kubernetes probes; Celery (A007); lint/type gates (A008); graceful-drain polish beyond `exec` + a published window (rows 1–3).

---

## 6. Re-verification of seed findings

| Finding | Verdict | Note |
|---------|---------|------|
| OBS-03 | **Confirmed** | Static `/health`; no lifespan; HEALTHCHECK uses liveness only → rows 4–6 |
| DATA-04 | **Confirmed** | No freshness gate; snapshot age not enforced → row 9 |
| ARCH-04 (lifespan half) | **Confirmed** | No dispose-on-shutdown. Impact low on snapshot-only; high if VIEW stays |
| INFRA-02 | **Confirmed** | No tagged image, no rollback procedure → rows 16–18 |
| INFRA-05 | **Confirmed** | No snapshot backup/restore → row 19 |
| uvicorn SIGTERM (assessment: “default is enough”) | **Revised** | Default uvicorn drain never runs while PID 1 is `sh`. Drain **not executed** |

---

## 7. Open questions (block checklist close-out)

| ID | Question | Rows |
|----|----------|------|
| **O-1** | G-1: production = snapshot only? | 2, 10 |
| **O-2** | Freshness SLA (A002 O-1) | 6, 9, 22 |
| **O-3** | Alert channel (A005 G-5) | 22 |
| **O-4** | Registry, deploy host, RPO/RTO sign-off (A006) | 16–20 |
| **O-5** | Network-lock waiver for auth P1, and the S-04 compensating control | 11, 15 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-04 | Initial REPORT-A009 from SPEC execution (EN). |
