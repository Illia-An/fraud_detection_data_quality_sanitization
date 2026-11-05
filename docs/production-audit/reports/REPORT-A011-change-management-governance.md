# REPORT-A011 — Change Management & Post-Release Governance

| Field | Value |
|-------|--------|
| **Spec** | [SPEC-A011](../specs/SPEC-A011-change-management-governance.md) |
| **Branch** | `audit/production-readiness` |
| **Date** | 2026-11-05 |
| **Method** | Static review of `docs/BRANCHING.md`, `.github/workflows/ci.yml`, `docker-compose.yml`, `README.md` (Docker section), `.env.docker.example`, `src/schemas/pipeline.py`, `web/src/pages/TtsKitchenPage.tsx`, `web/src/i18n/messages/en.ts`. GitHub branch protection is **not** visible from the repo and is not stated as fact. |
| **Status** | Report ready (host owner / freeze window / `main` protection open) |

> Governance on top of the deploy design in [REPORT-A006](./REPORT-A006-cicd-release-dr.md). This report does not add a new pipeline.
> Cross-links: [REPORT-A004](./REPORT-A004-testing-quality.md) (SM-10…14),
> [REPORT-A007](./REPORT-A007-performance-scalability.md) (P-11 refresh lock),
> [REPORT-A009](./REPORT-A009-production-readiness-golive.md) (cutover),
> [REPORT-A010](./REPORT-A010-api-contracts-mocking.md) (C-01 Pydantic ↔ Zod).

---

## 1. Checklist

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | No live-prod edits | **Fail** | Source is not mounted into the container; only sqlite `:ro`. README deploy is `docker compose build && up` from the working directory. The image is always `fraud-dq-sanitization:local`. That builds whatever is on the host, not an immutable tag. `.env.docker` and both snapshots are edited on the host by the refresh scripts. The repo does not forbid hand edits on the live host. |
| 2 | Dev / Staging / Production are separate | **Fail** | Dev: Vite `:5173` + uvicorn `:8001` (`docs/BRANCHING.md`). The only “prod” is Docker Compose on `:8000` on the same class of machine. No Staging, no GitHub Environment, no second compose file. |
| 3 | Backward-compatible contract changes | **Partial** | The image is a monolith: API and SPA ship together, so “backend first, then frontend” does not apply. Old config keys survive via `migrate_legacy_pipeline_config` in `src/schemas/pipeline.py`. The only prefix is `/api/v1`. There is no Pydantic ↔ Zod check (A010 C-01). One test inspects OpenAPI for `POST /process`. |
| 4 | Feature flags | **Fail** as a platform, **Partial** as manual switches | No flag system. `KITCHEN_RUN_ENABLED = false` is hardcoded in `TtsKitchenPage.tsx:39` — a build constant, not a host switch. `en.ts` still says Kitchen is “coming soon” while the page exists and the button is simply disabled. Real source switches are env: `SANITIZATION_SOURCE`, `TTS_KPI_SOURCE` (`.env.docker.example`). |
| ext | Immutable deploy by tag | **Fail** | `v*` tags are described in `BRANCHING.md`, but compose does not use them (A006 CD-01/02). `/health` reports `0.1.0`; the latest tag is `v1.30.0-tts-kpi-snapshot`. |
| ext | Prod config change control | **Fail** | Who may edit `.env.docker` and run refresh is not written down. |
| ext | CI + smoke before promote | **Partial** | CI on PR to `main`: pytest, lint, vitest, Playwright (`.github/workflows/ci.yml`). The image is not built. Post-deploy smoke is not required. `on.push.branches` still lists `feat/react-ui-v2` and `feat/db-sample-2026`, while the strategy is short-lived branches. |

**The launch blocker is not “no LaunchDarkly”.** It is the missing rule: the internal host receives only a tagged image after CI and smoke, and env and snapshots change by a written record, not by an SSH edit. A full third environment and a flag platform are **Defer**.

---

## 2. As-is vs target change workflow

**As-is.** `feat/*` → PR into `main` → CI → merge → tag optional → on the host `docker compose build` from the working tree → container `:local`. Rollback is a rebuild of an old commit, if npm/PyPI are reachable (A006).

**Target for internal v1:**

1. PR into `main`, CI green. No direct push to `main`. Branch protection must be turned on in GitHub — the repo does not prove it is on.
2. Tag `vX.Y.Z` only from `main`. CI builds the image with that tag.
3. On a machine that is not the internal host, run compose and smoke SM-10…14 (A004).
4. On the internal host: `IMAGE_TAG=vX.Y.Z docker compose pull && up`. Not `build` from a working copy.
5. Smoke failure → previous tag and previous snapshot file (A006, A009).
6. A change to `.env.docker` or a snapshot refresh is its own record: who, when, which `loaded_at`. Not an unlogged shell edit.

---

## 3. Environment matrix

| Environment | Exists? | Data | Who touches it |
|-------------|---------|------|----------------|
| Dev | Yes | synthetic or a local snapshot | developer, ports 5173/8001 |
| Staging | No | — | — |
| Internal prod | Effectively one Docker host on `:8000` | host snapshots, mounted `:ro` | whoever has a shell; owner not named |

Until a real Staging exists, the allowed substitute is a required compose run on a machine that users do not use. That must be written down. It is not a second environment by itself.

---

## 4. Compatibility policy

Policy for this repo: **one tagged monolith**, not “BE first”.

- Do not break `/api/v1` JSON inside a tag that already shipped an older SPA. They travel in one image, but future external clients and old `/docs` bookmarks do not.
- New fields are additive only. Keep old config keys via `migrate_legacy_pipeline_config`.
- Renaming a field means a new path or an explicit migration, plus a green C-01 (OpenAPI ↔ Zod).
- Switching `SANITIZATION_SOURCE` to VIEW is a source change, not a feature flag. Until G-1 is decided, prod stays `snapshot`.

---

## 5. Feature-flag stance

A separate flag service is not needed for a handful of analysts (SPEC non-goal).

Enough for v1:

- Data source only via env (`SANITIZATION_SOURCE`, `TTS_KPI_SOURCE`). A change is a line in the host change log.
- Do not turn Kitchen on with a constant in the repo. Either hide the page until it is ready, or use an env switch so it can be turned off without rebuilding screen logic.
- Remove the “coming soon” navigation string, or make it match `KITCHEN_RUN_ENABLED`. Otherwise an operator cannot tell a deliberate off from a leftover label.

---

## 6. Governance backlog

| ID | Item | Class |
|----|------|-------|
| **G-01** | Rule: the internal host gets a tag-built image only, not `compose build` from a working tree. Same fix as A006 CD-01/02 | **Blocker** |
| **G-02** | Before changing the host: CI green + smoke SM-10…14 on a non-user machine. Name who runs it | **Blocker** |
| **G-03** | Log of `.env.docker` edits and refreshes (who / when / `loaded_at`). Names are an open question | **Blocker** |
| **G-04** | Short policy text: monolith, additive fields only, do not break legacy keys | **Defer** (document, not code) |
| **G-05** | Drop dead branches from `ci.yml` `on.push` | **Defer** |
| **G-06** | Protect `main` (review + green CI). Not visible in the repo | **Defer**, until the host is updated from `main` outside a PR |
| **G-07** | A separate Staging and a flag platform | **Defer** |

---

## 7. Open questions

| ID | Question |
|----|----------|
| **O-1** | Who owns the internal host, and who may edit `.env.docker` and run refresh? |
| **O-2** | Is a freeze window required during refresh? (A007 P-11, A009) |
| **O-3** | Is GitHub protection enabled on `main`? The repo files do not say. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-05 | Initial REPORT-A011 from SPEC execution (EN). |
