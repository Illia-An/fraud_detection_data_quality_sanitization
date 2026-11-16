# Wave 6 report — Auth & security P1

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | S-02 P1, S-04/S-05, S-09, S-10, S-13, S-14 |

## Goal

401 without identity on `/api/v1/*`; `/health` open; PII-at-rest decision recorded and enforced on refresh.

## Decisions

| ID | Status | Value |
|----|--------|--------|
| **PII** | `PROPOSED` | Keyed HMAC at refresh (`PII_HMAC_KEY`); always hash contacts into snapshot; meta `pii_hashed_at_rest=1` |
| Auth | Engineering | Shared `API_KEY` stop-gap (SSO later); disabled when unset |
| Docs | Docker default off | `ENABLE_DOCS=0` |
| TLS | `DOCUMENTED` | Terminate at reverse proxy (`docs/ops/DEPLOY_RUNBOOK.md`) |

## What we did

| # | Work | Result |
|---|------|--------|
| 6.1 | AuthN on `/api/v1/*` | **Done** — `X-API-Key` / Bearer; `/health`+`/ready` open |
| 6.2 | PII hash at refresh | **Done** — HMAC when pepper set; SHA-256 fallback; skip double-hash on read |
| 6.3 | Security regression suite | **Done** — `tests/test_security_regression.py` |
| 6.4 | Disable `/docs` in prod; strip validation `input` | **Done** |
| 6.5 | TLS at proxy | **Done** (runbook) |
| 6.6 | gitleaks + pip-audit in CI | **Done** |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/auth.py` | **Added** — API key middleware |
| `backend/main.py` | Auth middleware, docs gate, validation trim |
| `src/fraud_guard/pii.py` | HMAC via `PII_HMAC_KEY` |
| `backend/snapshot_refresh.py` | Hash PII before write + meta flags |
| `backend/snapshot.py` / `db_sample.py` / `queries.py` | `pii_hashed_at_rest` read path |
| `web/src/api/client.ts` / `config.ts` | Send `VITE_API_KEY` |
| `Dockerfile` / `docker-compose.yml` | `ENABLE_DOCS=0`, key env, build-arg |
| `.github/workflows/ci.yml` | gitleaks job + `uvx pip-audit` |
| `docs/ops/DEPLOY_RUNBOOK.md` | TLS + AuthN |
| `WAVE-0-DECISIONS.md` | PII PROPOSED |
| `tests/test_security_regression.py` | **Added** |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests/test_security_regression.py tests/test_db_sample.py tests/test_snapshot_integrity.py tests/test_observability.py -v
→ 34 passed
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| 401 without identity when `API_KEY` set | **Yes** |
| `/health` open | **Yes** |
| PII decision recorded | **Yes** (PROPOSED keyed hash at refresh) |

## Follow-ups

- Owner **SIGN** PII (or disk-encryption waiver)
- Prefer SSO proxy over SPA-baked API key for anything beyond LAN
- Re-hash existing host snapshots via one refresh with `PII_HMAC_KEY`
- Wave 7 architecture cleanup
