# Wave 7 report — Architecture cleanup

| Field | Value |
|-------|--------|
| **Branch** | `feat/prod-source-truth` |
| **Date** | 2026-11-16 |
| **Audit IDs** | A-03, A-05, A-07, A-08, A-09, A-10, M-03, M-08, M-11, M-12, A005 |

## Goal

OpenAPI behaviour unchanged; easier to add endpoints and logging via routers + a public data-access seam.

## What we did

| # | Work | Result |
|---|------|--------|
| 7.1 | Move `run_process_db()` out of HTTP handler | **Done** — `backend.service.run_process` / `run_process_db`; thin router |
| 7.2 | Split `create_app` into `APIRouter`s | **Done** — `backend/routers/*`; `/sample/db` before `/sample/{preset}` |
| 7.3 | Public `data_access` module | **Done** — `backend/data_access.py`; queries/scripts stop private `_` imports |
| 7.4 | Engine lifecycle / timeouts (VIEW=dev) | **Done** — URL cache, lifespan `dispose_engines`, MSSQL connect timeout |
| 7.5 | Typed settings; reduce config sprawl | **Done** — `backend/settings.AppSettings`; CORS default aligned |
| 7.6 | Remove stale `tts_guard` / `tts_order_bump` | **Done** — `pyproject.toml` hatch packages |
| 7.7 | Lazy `tier3` / sklearn | **Done** — `fraud_guard.__getattr__` |
| 7.8 | Single-source app version | **Done** — `backend/version.py` ← pyproject / `APP_VERSION` |

## What changed (files)

| Path | Change |
|------|--------|
| `backend/main.py` | Slim factory: middleware + lifespan + `include_routers` |
| `backend/routers/*` | **Added** — health, sample, process, plans, tts_kpi, tts_kitchen, reports |
| `backend/app_common.py` | **Added** — shared response / plan-store helpers |
| `backend/service.py` | `run_process` / `run_process_db` / `ProcessOutcome` |
| `backend/data_access.py` | **Added** — public seam + engine cache/dispose |
| `backend/settings.py` / `version.py` | **Added** — typed settings + version resolution |
| `backend/db_sample.py` | Public `period_params` / `build_sql` / `engine_from_settings` / … |
| `backend/queries.py` / scripts | Import from `data_access` |
| `backend/snapshot.py` / `db/connection.py` | Cached engines |
| `src/fraud_guard/__init__.py` | Lazy tier3 |
| `pyproject.toml` | Drop stale packages |
| `tests/test_wave7_architecture.py` | **Added** |
| `tests/test_db_sample.py` / `test_queries.py` / `test_query_b.py` | Monkeypatch paths → service/routers |

## Verification

```text
.venv\Scripts\python.exe -m pytest tests -q
→ 204 passed
```

## Done-when checklist

| Criterion | Result |
|-----------|--------|
| OpenAPI behaviour unchanged (paths / process contract) | **Yes** |
| Easier to add endpoints / logging | **Yes** (routers + `run_process` outside HTTP) |

## Follow-ups

- Wave 8: planner/TTS product twins (out of scope here)
- Further env consolidation into `AppSettings` for TTS KPI / snapshot gates when those modules are touched
- Optional: move sklearn to a `research` extra once CI confirms API image does not need it
