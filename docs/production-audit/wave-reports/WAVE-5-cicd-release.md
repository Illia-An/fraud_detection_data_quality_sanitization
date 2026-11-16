# Wave 5 report — CI/CD & release hygiene

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | CD-01…05, G-01, G-05/G-06, SM-01/02, SM-10…14, T-07, RG-N10, A011 |

## Goal

Deploy by tagged image, not `compose build` from a working tree on the user host.

## Decisions used

| ID | Status | Value |
|----|--------|--------|
| **REG** | `PROPOSED` | `ghcr.io/<owner>/fraud-dq-sanitization` |
| **HOST** | `PENDING` | Slot in refresh/deploy runbooks |
| **FRESH** | `PROPOSED` 14d | Fixtures/smoke use `SNAPSHOT_MAX_AGE_DAYS=36500` |

## What we did

| # | Work | Result |
|---|------|--------|
| 5.1 | CI builds `sha-*` (+ `vX.Y.Z` on tags); push to GHCR on `main`/tags | **Done** |
| 5.2 | Image smoke: `/health`, `/ready`, non-root, SM-10…14 | **Done** (`scripts/smoke_image.sh`) |
| 5.3 | Compose `IMAGE_REPO` / `IMAGE_TAG` / `PULL_POLICY` | **Done** |
| 5.4 | Post-deploy smoke + rollback scripts | **Done** |
| 5.5 | Refresh runbook + second-operator table | **Done** |
| 5.6 | Drop stale `ci.yml` push branches; document protect `main` | **Done** |
| 5.7 | E2E against snapshot fixture (`RG-N10`) | **Done** |

## What changed (files)

| Path | Change |
|------|--------|
| `.github/workflows/ci.yml` | Node/uv pin; image job; fixture build; push branches cleaned |
| `docker-compose.yml` | `IMAGE_REPO` / `IMAGE_TAG` / `PULL_POLICY` |
| `backend/ci_fixtures.py` | Synthetic fixture builder |
| `scripts/build_ci_fixtures.py` | CLI |
| `scripts/smoke_post_deploy.py` | SM-10…14 + `/ready` |
| `scripts/smoke_image.sh` | Container smoke |
| `scripts/rollback_deploy.ps1` / `.sh` | Tag (+ optional `.prev`) rollback |
| `docs/ops/DEPLOY_RUNBOOK.md` | Pull-only deploy + G-05 |
| `docs/ops/REFRESH_RUNBOOK.md` | Refresh + second operator |
| `testdata/fixtures/*` | Committed synthetic sqlite + README |
| `web/playwright.config.ts` | Point uvicorn at fixtures |
| `web/tests/e2e/sanitization-snapshot.spec.ts` | RG-N10 |
| `tests/test_smoke_post_deploy.py` | API-level smoke |
| `WAVE-0-DECISIONS.md` | REG PROPOSED |
| `docs/BRANCHING.md` | Image tags + protect main |

## Verification

```text
.venv\Scripts\python.exe scripts\build_ci_fixtures.py
.venv\Scripts\python.exe -m pytest tests/test_smoke_post_deploy.py tests/test_ready.py tests/test_health.py tests/test_observability.py -v
→ 13 passed
```

Image smoke (`scripts/smoke_image.sh`) runs in GitHub Actions `image` job (requires Docker).

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| Internal host can pull tagged image | **Yes** (compose + runbook; REG proposed GHCR) |
| Rollback = previous tag + `.prev` | **Yes** (scripts) |
| CI proves `/health` + `/ready` + non-root | **Yes** (image job) |

## Follow-ups

- Owner **SIGN** REG / HOST; enable GitHub branch protection UI for `main`
- Package visibility on GHCR (private) + deploy-host `docker login`
- Second-operator refresh drill (table in REFRESH_RUNBOOK)
- Wave 6 auth / PII
