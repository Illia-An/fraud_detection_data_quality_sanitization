# REPORT-A006 — CI/CD: Deploy Pipeline, Rollback & Disaster Recovery

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A006](../specs/SPEC-A006-cicd-release-dr.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-04 |
| **Method** | Static review of `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env*.example`, README (Docker section), `docs/BRANCHING.md`, and git tags. Image build, container run, and CI were **not** executed; Docker behaviour for a missing bind-mount source is taken from stock Docker semantics. |
| **Status** | Report ready (registry, deploy host, RPO/RTO sign-off open) |

> **Reality check.** There is no application OLTP database. “Database backup / DR” means
> integrity and copies of the **two SQLite snapshot files**, plus the ability to rebuild them
> from SQL Server via the refresh procedure. The container is read-mostly and **cannot reach
> SQL Server** (no `msodbcsql` / `unixodbc` in the `Dockerfile`).
> Cross-links: [REPORT-A002](./REPORT-A002-db-data-integrity.md) (D-01/02/05, atomic refresh,
> `schema_version`), [REPORT-A003](./REPORT-A003-security-hardening.md) (S-04/S-07, secrets),
> [REPORT-A004](./REPORT-A004-testing-quality.md) (`SM-*`),
> [REPORT-A005](./REPORT-A005-observability.md) (`/ready`, `AL-*`).

---

## 1. As-is vs to-be

### As-is (from code and README)

1. A developer merges to `main` via PR. CI runs `pytest`, `eslint`, `vitest`, `vite build`,
   and Playwright (synthetic). **The image is neither built nor published.**
2. An operator manually runs `refresh_*_snapshot.py` on a host with VPN / Trusted Connection
   and writes into the live `data/*.sqlite` files (A002 D-01).
3. The operator manually runs `docker compose build && docker compose up -d`
   (README:96-97). The image is always tagged `fraud-dq-sanitization:local`.
4. The container bind-mounts the snapshot **files** `:ro`. There is no post-start smoke;
   `HEALTHCHECK` hits the static `/health` endpoint.
5. Rollback: `git checkout <old tag>` + rebuild (36 git tags, e.g. `v1.0.0` … `v1.x`; the
   app still reports version `0.1.0`).

### To-be

CI builds an image tagged with git SHA / release tag → image smoke → push to a registry →
deploy on the host **by tag** → pre/post-deploy smoke → on failure, auto-rollback to the
previous tag. Refresh is a separate scheduled job with atomic swap, `.prev`, and
`last_success_at` (A002 / A005). DR is snapshot copies + a runbook + one rollback drill.

---

## 2. Direct answers

### What happens if a new build fails at startup?

| Situation | As-is | Target |
|-----------|-------|--------|
| **Build fails** (npm / PyPI / GHCR unavailable; the `Dockerfile` itself notes GHCR 403s) | `compose build` fails; the previous container may still be running, **but** if `up` already ran, the `:local` tag was overwritten and the old image is now an untagged dangling layer | Build in CI; the deploy host only `pull`s a tag — host build dependencies go away |
| **Container crashes on start** | `up -d` recreates the container: the old one is stopped; `restart: unless-stopped` enters a **restart loop**; there is no prior-good revision → **service is down** | New tag is started; smoke fails → automatic `up` of `previous_tag`; proposed RTO ≤ 15 min |
| **Starts “healthy” but is broken** (missing snapshot, missing `web/dist`, wrong env) | Process is up, `/health` = 200, `HEALTHCHECK` is green → “healthy but broken”; if a bind-mount source file is missing, Docker creates a **directory** with that name on the host → `Snapshot not found` (503) | Pre-deploy checks for files / `schema_version` / age; post-deploy `SM-10…14`; `/ready` (A005) |
| **Docker will not restart an “unhealthy” container** | Without an orchestrator, `HEALTHCHECK` only marks status | External probe `AL-01/02` + a rollback script |

### How does rollback work?

- **As-is:** there is no “rollback” operation — only rebuild from an old git tag (needs npm,
  PyPI, GHCR; build time was not measured). Data compatibility is not guaranteed:
  `schema_version` is missing (A002 D-05).
- **Target:** `IMAGE_TAG=<prev> docker compose up -d` (≤ 5 min); keep the last N=5 tags
  locally and in the registry; record `git tag ↔ image tag ↔ digest` at release time;
  roll back snapshot data separately via `.prev`.

### How do backup / restore of the “database” work?

- **As-is:** they do not. Files live under `data/`, are not in git (`.gitignore`,
  `.dockerignore`), and have no copies or retention (INFRA-05); refresh overwrites in place.
- **Target:** see §5 (DR Plan): `.prev` after every refresh + off-host copies with retention
  + a restore script / runbook. Source of truth is SQL Server, so data is **rebuildable**;
  “loss” is downtime / staleness, not permanent data loss, while the source remains reachable.

---

## 3. Step-by-step deploy pipeline (target)

| # | Step | Action | Gate / check | On failure |
|---|------|--------|--------------|------------|
| 1 | PR CI | `pytest`, `eslint`, `vitest`, `build`, Playwright (+ `RG-N*` from A004) | All green | Merge blocked |
| 2 | Release | Annotated git tag `vX.Y.Z` on `main` | CI green on that SHA | Tag is not created |
| 3 | Build | CI builds the image; tags `vX.Y.Z` + `sha-<7>`; labels (SHA, build time); app version from the tag | Build succeeds; Node aligned (CI 22 vs Docker 20) | Release is not published |
| 4 | Image smoke | `docker run` with a committed fixture snapshot: `/health`, `/ready`, `id` ≠ root, `SM-01/02`; CVE scan **non-blocking** at first | `SM-01/02` pass | Image is not pushed |
| 5 | Publish | Push to the registry (private; O-1) | Digest recorded | Retry; release not marked |
| 6 | Pre-deploy (host) | Snapshot files present; `schema_version` compatible with the image; age ≤ SLA; free disk; `previous_tag` recorded | All checks OK | **Deploy cancelled; nothing changed** |
| 7 | Backup | Copy current `data/*.sqlite` (or rely on `.prev` from A002) | Copy exists, size > 0 | Deploy cancelled |
| 8 | Deploy | `IMAGE_TAG=vX.Y.Z docker compose pull && up -d`; env from host `.env.docker`, not from the repo | Container `running` within start-period | Auto-rollback to `previous_tag` |
| 9 | Post-deploy smoke | `SM-10…SM-14` (A004) within ≤ 5 min | All pass | Auto-rollback + alert |
| 10 | Promote / record | Record `current_tag`, digest, date, git-tag link; update runbook / release notes | Record created | Manual fix; does not block |
| 11 | **Refresh (separate)** | On a schedule on the refresh host: tmp → gates → atomic swap → `.prev` → `last_success_at` | A002 gates | Old snapshot remains; `AL-08` |

---

## 4. Boot-failure and rollback procedures (design; not executed in this audit)

Host is Windows / Docker Desktop (README uses `copy` and PowerShell).

**4.1 Deploy with auto-rollback (target script; not implemented):**

```powershell
# 0) capture current
$prev = (docker inspect fraud-dq --format '{{.Config.Image}}')
# 1) roll out the new tag
$env:IMAGE_TAG = 'v1.31.0'
docker compose pull
docker compose up -d
# 2) smoke (SM-10..14); on any failure
$env:IMAGE_TAG = $prev.Split(':')[-1]
docker compose up -d
```

**4.2 Manual rollback (runbook):**

1. Identify the previous good tag (`current_tag` recorded in step 10).
2. `IMAGE_TAG=<prev>` → `docker compose up -d`.
3. Verify `SM-10…14` and `/ready`.
4. If data is incompatible with the previous image, restore the snapshot from `.prev`
   (§5.3) and repeat step 3.
5. Record the incident and root cause.

**RTO / RPO (proposal for sign-off, O-5):**

| Scenario | RTO | RPO |
|----------|-----|-----|
| Bad deploy | ≤ 15 min | — (data unchanged) |
| Corrupt / empty snapshot | ≤ 15 min (restore `.prev`) | Up to the last successful refresh |
| Lost refresh host | Service keeps serving the last snapshot (stale); rebuild ≤ 1 business day | Refresh interval (source is SoT) |
| Registry outage | ≤ 30 min (local tags; fallback `docker load` from archive) | — |

---

## 5. Disaster Recovery Plan

### 5.1 What to back up

| Object | Lives at | Backup | Retention | Note |
|--------|----------|--------|-----------|------|
| Images | Registry + local host | Release tags forever; last 5 `sha-*` | 5 + all `vX.Y.Z` | Plus `docker save` of the current release onto backup media |
| `docker-compose.yml`, `.env.docker.example`, refresh scripts | Git | Git + tags | Forever | No secrets |
| Real `.env.docker` and secrets | Host | Secret store / password manager, **outside git and the image** | Per policy | Snapshot-only container needs **no** secrets today |
| `q10012_snapshot.sqlite` (~190 MB) | `data/` | `.prev` + off-host copies, **encrypted / ACL as for PII** (A003 S-04) | 3 latest + 1 weekly | Plaintext PII in SQLite |
| `tts_kpi_snapshot.sqlite` (~216 KB) | `data/` | Same | Same | Small; no PII |
| Runbook, refresh-host config (scheduler, service account, ODBC driver, VPN) | Repo / wiki | Versioned in git | — | Closes the SPOF |

### 5.2 Schedule

After **every successful refresh**: `.prev` + an off-host copy. Weekly: verify the copy is
readable (`SELECT 1`, `schema_version`, `row_count`). Rollback / restore drill — **once
before release**, then on a cadence (Defer).

### 5.3 Restore

1. **Bad deploy:** §4.2.
2. **Corrupt / empty snapshot:** stop refresh → place `.prev` (or a copy) into `data/` via
   atomic rename → verify gates (`schema_version`, rows, age) → `/ready` → `SM-13`.
3. **Lost refresh host:** stand up a host (ODBC driver, VPN, account) →
   `git checkout <tag>` → `uv sync --frozen` → secrets → refresh → gates → swap. While
   recovery is in progress the service serves the last snapshot; `AL-06` signals staleness.
4. **Registry unavailable:** use local tags; otherwise `docker load` from archive; last
   resort — rebuild from a git tag (needs npm / PyPI / GHCR).
5. **Lost entire Docker host:** new host → image by tag → snapshot copies → env from the
   secret store → pre-deploy checks → smoke.
6. **Secret leak:** rotate DreamFactory key / DB credentials; restart the container with a
   new `.env.docker`; verify logs (A005 redaction).

### 5.4 Loss scenarios

| Scenario | Effect | Response |
|----------|--------|----------|
| Bad deploy | Service down or degraded | §4 |
| Corrupt snapshot | 503 / wrong numbers | §5.3 step 2 |
| Lost refresh host | Data goes stale | §5.3 step 3, `AL-06/08` |
| SQL Server unavailable | Refresh fails; app serves the last snapshot | Alert `AL-08`, wait |
| Registry out | New deploys impossible | §5.3 step 4 |
| Host lost | Downtime | §5.3 step 5 |

---

## 6. Secrets & env isolation — checklist

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Secrets are **not baked** into the image: `.dockerignore` excludes `.env`, `.env.*`, `data/`, `*.sqlite`; `Dockerfile` copies only `src`, `backend`, `db` | **OK** | `.dockerignore`, `Dockerfile` COPY |
| 2 | No secrets in the repo; `.env*` in `.gitignore`; examples empty | **OK** | A003 S-13 |
| 3 | `env_file: .env.docker` with `required: false` → if the file is missing the container silently starts on **baked defaults** | **Gap** | `docker-compose.yml` |
| 4 | One compose + one example env; **no dev / stage / prod split** | **Gap** | Repo |
| 5 | Defaults are baked into `Dockerfile` ENV (`API_CORS_ORIGINS=http://localhost:8000`, etc.) — prod needs an explicit override | **Gap** | `Dockerfile` ENV |
| 6 | Secret delivery: root-only `env_file` on the host or compose `secrets:`; no vendor lock-in; the app reads env only | **Recommendation** | — |
| 7 | CI secrets (registry) — GitHub Actions secrets only, least privilege, never printed | **Recommendation** | — |
| 8 | Rotation: procedure and owner recorded in the runbook | **Gap** | — |

Secrets that will be needed: registry credentials (CI), SSO client secret (A003 P1-1),
pepper / HMAC (A003 O-4), `TTS_KPI_API_KEY` (only when `dreamfactory` is used).

---

## 7. Findings registry

| ID | Finding | Evidence | Verdict | Class | Sev | Effort | Fix |
|----|---------|----------|---------|-------|-----|--------|-----|
| **CD-01** | CI neither builds nor publishes an image; deploy is `compose build && up` on the host; tag is always `:local` | `ci.yml` (jobs `backend` / `frontend` / `e2e`); `docker-compose.yml` `image: …:local` (INFRA-02) | Confirmed | **Release blocker** | High | M | Build job + tag by git tag/SHA + push; compose uses `${IMAGE_TAG}` |
| **CD-02** | No rollback target: rebuild overwrites `:local`; rollback = rebuild of an old tag against external networks (npm, PyPI, GHCR); data compatibility unchecked | README:96-105; `Dockerfile` header | Confirmed | **Release blocker** | High | S–M | Keep N tags; `IMAGE_TAG=<prev>`; tag↔digest mapping; `schema_version` (A002 D-05) |
| **CD-03** | Boot failure: restart loop, no prior-good revision; “healthy but broken” passes `HEALTHCHECK`; no post-deploy smoke | `docker-compose.yml` (`restart: unless-stopped`); `/health` static (A005 OB-03) | Confirmed | **Release blocker** | High | S–M | Pipeline steps 6, 8, 9; auto-rollback; `/ready` |
| **CD-04** | No snapshot backup/restore; refresh in-place; no retention or off-host copies | A002 D-01/D-02; INFRA-05 | Confirmed | **Release blocker** | High | S–M | `.prev` + copies + retention + restore runbook (§5) |
| **CD-05** | Refresh host is a SPOF: manual run, single operator, ODBC/VPN dependency, no schedule | INFRA-01; `scripts/refresh_*.py` | Confirmed | **Release blocker** (minimum: runbook + second operator + `AL-08`); scheduled automation is P1 | High | S–M | Runbook, owner, scheduler later |
| **CD-06** | Bind-mount of **single files** `:ro`: missing source creates a directory; atomic swap pins the inode | `docker-compose.yml:17-18`; A002 D-02 | Potential | **Release blocker** (shared fix with A002 D-02) | High | S | Mount the `data/` directory |
| **CD-07** | Env drift: no dev/stage/prod; `env_file required:false`; defaults in ENV | `docker-compose.yml`, `Dockerfile` ENV | Confirmed | **Defer** (single-env internal), but `required: true` in a prod override belongs in the next PR | Med | S | Compose override + per-env `.env.<env>` outside the repo |
| **CD-08** | CI/runtime drift: Node 22 in CI vs Node 20 in Docker; uv unpinned in CI, `0.6.14` in Docker; `push` triggers include stale branches | `ci.yml`, `Dockerfile` (INFRA-03) | Confirmed | **Defer** (align in step 3) | Low–Med | S | Single Node/uv version; clean branch filters |
| **CD-09** | Versioning: app reports `0.1.0` while tags reach `v1.x`; `docs/BRANCHING.md` lists tags only through `v1.1.0` and port 8001; no `CHANGELOG.md` | `schemas.py`, BRANCHING.md, `Test-Path CHANGELOG.md` = False | Confirmed | **Defer** (version injection is part of CD-01) | Low–Med | S | `APP_VERSION` from the tag; refresh BRANCHING |
| **CD-10** | Build reproducibility: lockfiles exist (`uv.lock` with `--frozen`, `npm ci`), but base images use floating tags (`node:20-bookworm-slim`, `python:3.12-slim-bookworm`); depends on GHCR for `uv` | `Dockerfile` | Partial | **Defer** | Low–Med | S | Digest pins, mirror / cache |
| **CD-11** | `CMD ["sh","-c","uv run uvicorn …"]`: `uv run` at start may sync the environment (needs write access under `/app`, potentially network); conflicts with non-root / read-only rootfs (A003 P0-4) | `Dockerfile` CMD | Potential | **Defer** (fix in the same PR as S-07: `--no-sync` or `.venv/bin/uvicorn`) | Med | S | Start uvicorn directly |
| **CD-12** | No image CVE scan / SBOM; container runs as root (A003 S-07) | `ci.yml`, `Dockerfile` | Confirmed | **Defer** (scan); root is a blocker in A003 | Med | S–M | Scan in CI after step 3 |
| **CD-13** | Bloated image (sklearn / openpyxl / matplotlib per ARCH-06); `backend/requirements.txt` is stale | Assessment ARCH-06; `Test-Path backend/requirements.txt` = True | Confirmed (assessment) | **Defer** | Low–Med | S | Optional `research` extra |
| **CD-14** | No zero-downtime: `compose up` recreates the container; deploy causes a brief outage | README:104-105 | Confirmed | **Defer** (acceptable for internal) | Low | M | Later: parallel start + switch |
| **CD-15** | **Strength:** the image contains neither secrets nor data (`.dockerignore`: `.env*`, `data/`, `*.sqlite`, `notebooks`, `*.ipynb`; `Dockerfile` copies only `src backend db`) | `.dockerignore`, `Dockerfile` | Confirmed | — | — | — | Keep |

---

## 8. Backlog: blockers vs Defer

**Release blockers (minimum before internal release):** CD-01, CD-02, CD-03, CD-04, CD-05,
CD-06.

Order:

1. CD-06 + CD-04 + CD-05 (data / refresh; shared with A002).
2. CD-01 + CD-02 (build → registry → `IMAGE_TAG` → N tags).
3. CD-03 (pre/post-deploy smoke, auto-rollback, `/ready`).
4. Drill: deploy N → roll back to N-1 + restore `.prev` (assessment §F).

**Done criteria:** image is built in CI and tagged SHA / semver; the host keeps ≥ 5 previous
tags; `IMAGE_TAG=<prev> up -d` completes in ≤ 5 min on a drill; `.prev` restores cleanly;
a deploy that fails smoke rolls back automatically; the refresh runbook has an owner and a
second operator.

**Defer:** CD-07 … CD-14.

---

## 9. Re-verification of INFRA-*

| Seed | Verdict | Note |
|------|---------|------|
| INFRA-01 | **Confirmed** | No ODBC in `Dockerfile` (search `msodbcsql` / `unixodbc` / `odbc`: 0); refresh is manual from a VPN host |
| INFRA-02 | **Confirmed** | No build / push / scan in `ci.yml`; tag `:local` |
| INFRA-03 | **Confirmed** | Node 22 vs 20; stale `push` branches; uv unpinned in CI |
| INFRA-04 | **Partial** | Both lockfiles are tracked; ~40 branches remain on `origin`; no `.nvmrc` |
| INFRA-05 | **Confirmed** | No backup / retention for snapshots |
| SEC-08 (context) | **Confirmed** | No `USER` → A003 S-07 |

---

## 10. Open questions

- **O-1.** Registry: private GHCR or an internal registry? Who has publish rights?
- **O-2.** Deploy host: Windows / Docker Desktop or a Linux server? Who operates deploys?
- **O-3.** Who runs refresh, and where is the off-host backup media (encrypted)?
- **O-4.** Is a brief outage during deploy acceptable (maintenance window)?
- **O-5.** Sign-off on the RTO / RPO proposals in §4 (proposed, not agreed).
- **O-6.** Where are secrets stored (corporate password manager / secret store)?

---

## 11. Limitations

- Image was not built; `docker compose` and CI were not run; RTO / build time were not
  measured.
- Docker behaviour for a missing bind-mount source (directory creation) is assumed from
  stock semantics and was not verified live.
- Registry, deploy host, and backup media are unknown (O-1 … O-3).
- Stale search index: paths verified with `Test-Path` / `git ls-files`.

---

## Acceptance check (SPEC-A006 §7)

- [x] REPORT-A006 created; boot-fail, rollback, and backup answered explicitly (as-is + target, §2).
- [x] Deploy pipeline steps (§3) + DR plan (§5) present.
- [x] INFRA-* re-verified (§9); README index A006 updated.
